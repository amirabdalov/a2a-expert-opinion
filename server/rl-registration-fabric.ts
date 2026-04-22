// ──────────────────────────────────────────────────────────────────────────────
// A2A Global — RL Registration Fabric (Build 45.6.3)
// ──────────────────────────────────────────────────────────────────────────────
//
// Every authentication event (register / register-upgrade / login / OTP verify)
// emits a structured row into `registration_events`. This table is the
// foundation of A2A's data flywheel at the auth layer:
//
//   • Pricing bandit — features: utm_source, email_domain, ip_country, device
//   • Matching / cold-start policy — intended_role × domain signals
//   • Fraud GNN — (ip, device_fp, email_hash, utm_source) nodes and edges
//   • Lookalike expert recruiting — expert-intent embeddings from day 0
//   • Cohort LTV model — outcome labels (first_request_at, gmv_30d) back-filled
//
// Privacy: email is stored as sha256 hash; plaintext email stays only on the
// `users` table. Email domain (icloud.com, gmail.com) is stored separately for
// aggregation. IP is stored in plaintext for fraud-detection MVP — will be
// hashed with a rotating key once the fraud detector is live.
//
// Durability: dual-write to both SQLite (co-located with app) and Cloud SQL
// (source of truth for cross-revision analytics). All writes are
// fire-and-forget — registration never blocks on telemetry.
//
// AI-native invariants enforced here:
//   1. Every write carries policy_version and model_version for off-policy eval
//   2. Write captures features + alternatives so counterfactual eval is possible
//   3. Outcome labels (first_request_at, gmv_30d) can be back-filled by cron
//      and joined to the original decision context
// ──────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";
import { sqlite } from "./storage";
import { Pool } from "pg";

// Registration decision policy version — bump whenever the register handler
// or its gating logic changes, so off-policy eval can filter to one policy.
export const REGISTRATION_POLICY_VERSION = "registration-policy-v1.45.6.3";

// Model version placeholder — currently no pre-registration AI scoring, but
// the field is reserved so we can plug in the LTV/fraud model without a schema migration.
export const REGISTRATION_MODEL_VERSION = "heuristic-v0";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegistrationOutcome =
  | "created"                 // new user created
  | "otp_resent_existing"     // same-role email already existed, OTP re-sent
  | "role_mismatch"           // EMAIL_ROLE_MISMATCH 409 — wrong role on existing email
  | "rate_limited"            // hit registerLimiter
  | "validation_error"        // zod rejected body
  | "otp_send_failed"         // Resend threw
  | "role_upgraded"           // /register-upgrade: pristine role flip
  | "upgrade_blocked_nonpristine" // upgrade attempted but account has activity
  | "admin_role_changed"      // admin forced role change
  | "admin_user_deleted"      // admin hard-delete
  | "login_otp_sent"          // /api/auth/login
  | "otp_verified_register"   // /api/auth/verify-otp (new user)
  | "otp_verified_login"      // /api/auth/verify-login
  | "otp_invalid"             // OTP check failed
  | "otp_expired";            // OTP expired

export interface RegistrationEventInput {
  userId?: number | null;
  email?: string | null;              // plaintext — we hash before storing
  intendedRole?: string | null;       // what the client SENT
  finalRole?: string | null;          // what was saved (may differ from intended after upgrade)
  outcome: RegistrationOutcome;
  outcomeCode?: string | null;        // machine-readable sub-code (e.g., "EMAIL_ROLE_MISMATCH")
  ip?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;  // client-sent fingerprint (future)
  referrer?: string | null;
  landingPage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  sessionId?: string | null;
  latencyMs?: number | null;
  // AI-native feature envelope
  features?: Record<string, any> | null;
  alternatives?: Record<string, any> | null;
  predictedLtv?: number | null;
  predictedFraudScore?: number | null;
  // Error context (if outcome is an error)
  errorMessage?: string | null;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const HASH_SALT = process.env.REGISTRATION_EMAIL_HASH_SALT || "a2a-default-salt-2026";

function hashEmail(email: string): string {
  return crypto.createHash("sha256").update(`${HASH_SALT}:${email.toLowerCase().trim()}`).digest("hex");
}

function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  return at === -1 ? null : email.slice(at + 1).toLowerCase();
}

// Best-effort country from IP using the first octet — MVP heuristic only.
// Will be replaced by a real GeoIP lookup (MaxMind mmdb) once the fraud
// detector needs it. Safe fallback: returns null.
function guessIpCountry(_ip: string | null | undefined): string | null {
  // TODO Build 46: wire in mmdb lookup. Returning null now is correct — the
  // column is NULLABLE and downstream models handle missing features.
  return null;
}

// Compute a low-signal heuristic fraud score from IP + email domain.
// Real fraud GNN replaces this in Build 47.
function heuristicFraudScore(input: RegistrationEventInput): number {
  let score = 0;
  const ua = (input.userAgent || "").toLowerCase();
  const ip = input.ip || "";
  const domain = extractEmailDomain(input.email);
  if (!input.userAgent) score += 0.3;           // missing UA — bot-ish
  if (ua.includes("curl") || ua.includes("python") || ua.includes("wget")) score += 0.4;
  if (ua.includes("headless") || ua.includes("phantom")) score += 0.3;
  if (ip === "unknown" || !ip) score += 0.1;
  if (domain && domain.endsWith(".test")) score += 0.5; // internal test emails
  if (domain && ["mailinator.com","tempmail.com","guerrillamail.com"].includes(domain)) score += 0.6;
  return Math.min(1, score);
}

// ─── SQLite schema (local, fast reads for admin dashboards) ───────────────────

export function ensureRegistrationEventsSqlite(): void {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS registration_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        email_hash TEXT NOT NULL,
        email_domain TEXT,
        intended_role TEXT,
        final_role TEXT,
        outcome TEXT NOT NULL,
        outcome_code TEXT,
        ip TEXT,
        ip_country TEXT,
        user_agent TEXT,
        device_fingerprint TEXT,
        referrer TEXT,
        landing_page TEXT,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        utm_content TEXT,
        utm_term TEXT,
        policy_version TEXT NOT NULL,
        model_version TEXT,
        features TEXT,           -- JSON
        alternatives TEXT,       -- JSON
        predicted_ltv REAL,
        predicted_fraud_score REAL,
        session_id TEXT,
        latency_ms INTEGER,
        error_message TEXT,
        first_request_at TEXT,   -- outcome labels, back-filled later
        first_review_at TEXT,
        gmv_30d REAL,
        churned_30d INTEGER,     -- 0/1
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_reg_events_email_hash ON registration_events(email_hash);
      CREATE INDEX IF NOT EXISTS idx_reg_events_ip ON registration_events(ip);
      CREATE INDEX IF NOT EXISTS idx_reg_events_outcome_created ON registration_events(outcome, created_at);
      CREATE INDEX IF NOT EXISTS idx_reg_events_utm_source ON registration_events(utm_source);
      CREATE INDEX IF NOT EXISTS idx_reg_events_user_id ON registration_events(user_id);
    `);
  } catch (err) {
    console.error("[RL-FABRIC] Failed to ensure SQLite schema:", (err as Error).message);
  }
}

// ─── Cloud SQL schema (source of truth for analytics + training) ─────────────

export async function ensureRegistrationEventsCloudSql(pool: Pool | null): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS registration_events (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER,
        email_hash TEXT NOT NULL,
        email_domain TEXT,
        intended_role TEXT,
        final_role TEXT,
        outcome TEXT NOT NULL,
        outcome_code TEXT,
        ip TEXT,
        ip_country TEXT,
        user_agent TEXT,
        device_fingerprint TEXT,
        referrer TEXT,
        landing_page TEXT,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        utm_content TEXT,
        utm_term TEXT,
        policy_version TEXT NOT NULL,
        model_version TEXT,
        features JSONB,
        alternatives JSONB,
        predicted_ltv NUMERIC,
        predicted_fraud_score NUMERIC,
        session_id TEXT,
        latency_ms INTEGER,
        error_message TEXT,
        first_request_at TIMESTAMP,
        first_review_at TIMESTAMP,
        gmv_30d NUMERIC,
        churned_30d BOOLEAN,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_reg_events_email_hash ON registration_events(email_hash)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_reg_events_ip ON registration_events(ip)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_reg_events_outcome_created ON registration_events(outcome, created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_reg_events_utm_source ON registration_events(utm_source)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_reg_events_user_id ON registration_events(user_id)`);
    console.log("[RL-FABRIC] \u2705 registration_events schema ensured in Cloud SQL");
  } catch (err) {
    console.error("[RL-FABRIC] Failed to ensure Cloud SQL schema:", (err as Error).message);
  }
}

// ─── The single emit API (called from every auth endpoint) ────────────────────

export function emitRegistrationEvent(input: RegistrationEventInput, pool: Pool | null): void {
  // Fire-and-forget — registration must never block or fail on telemetry.
  (async () => {
    try {
      const email = input.email || "";
      const emailHash = email ? hashEmail(email) : "anon";
      const emailDomain = extractEmailDomain(email);
      const ipCountry = guessIpCountry(input.ip);
      const fraudScore = input.predictedFraudScore ?? heuristicFraudScore(input);

      // Structured log line — greppable, always on. This is the [REGISTER]
      // successor: richer, outcome-aware, and matches the DB row 1-to-1.
      console.log(`[RL-FABRIC] outcome=${input.outcome} role_intended=${input.intendedRole || '-'} role_final=${input.finalRole || '-'} email_domain=${emailDomain || '-'} utm=${input.utmSource || '-'}/${input.utmMedium || '-'}/${input.utmCampaign || '-'} ip=${input.ip || '-'} fraud=${fraudScore.toFixed(2)} policy=${REGISTRATION_POLICY_VERSION} user_id=${input.userId ?? '-'}`);

      // Truncate unbounded fields to keep row size sane
      const ua = (input.userAgent || "").substring(0, 500);
      const ref = (input.referrer || "").substring(0, 500);
      const landing = (input.landingPage || "").substring(0, 500);
      const errMsg = (input.errorMessage || "").substring(0, 500);
      const featuresStr = input.features ? JSON.stringify(input.features).substring(0, 8000) : null;
      const altsStr = input.alternatives ? JSON.stringify(input.alternatives).substring(0, 8000) : null;

      // SQLite write (synchronous inside the async wrapper, but bounded)
      try {
        sqlite.prepare(`
          INSERT INTO registration_events (
            user_id, email_hash, email_domain, intended_role, final_role,
            outcome, outcome_code, ip, ip_country, user_agent, device_fingerprint,
            referrer, landing_page, utm_source, utm_medium, utm_campaign,
            utm_content, utm_term, policy_version, model_version,
            features, alternatives, predicted_ltv, predicted_fraud_score,
            session_id, latency_ms, error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          input.userId ?? null, emailHash, emailDomain, input.intendedRole ?? null, input.finalRole ?? null,
          input.outcome, input.outcomeCode ?? null, input.ip ?? null, ipCountry, ua, input.deviceFingerprint ?? null,
          ref, landing, input.utmSource ?? null, input.utmMedium ?? null, input.utmCampaign ?? null,
          input.utmContent ?? null, input.utmTerm ?? null, REGISTRATION_POLICY_VERSION, REGISTRATION_MODEL_VERSION,
          featuresStr, altsStr, input.predictedLtv ?? null, fraudScore,
          input.sessionId ?? null, input.latencyMs ?? null, errMsg || null,
        );
      } catch (sqliteErr) {
        console.error("[RL-FABRIC] SQLite insert failed:", (sqliteErr as Error).message?.substring(0, 120));
      }

      // Cloud SQL write (async, best-effort)
      if (pool) {
        try {
          await pool.query(
            `INSERT INTO registration_events (
              user_id, email_hash, email_domain, intended_role, final_role,
              outcome, outcome_code, ip, ip_country, user_agent, device_fingerprint,
              referrer, landing_page, utm_source, utm_medium, utm_campaign,
              utm_content, utm_term, policy_version, model_version,
              features, alternatives, predicted_ltv, predicted_fraud_score,
              session_id, latency_ms, error_message
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
            [
              input.userId ?? null, emailHash, emailDomain, input.intendedRole ?? null, input.finalRole ?? null,
              input.outcome, input.outcomeCode ?? null, input.ip ?? null, ipCountry, ua, input.deviceFingerprint ?? null,
              ref, landing, input.utmSource ?? null, input.utmMedium ?? null, input.utmCampaign ?? null,
              input.utmContent ?? null, input.utmTerm ?? null, REGISTRATION_POLICY_VERSION, REGISTRATION_MODEL_VERSION,
              featuresStr ? JSON.parse(featuresStr) : null,
              altsStr ? JSON.parse(altsStr) : null,
              input.predictedLtv ?? null, fraudScore,
              input.sessionId ?? null, input.latencyMs ?? null, errMsg || null,
            ]
          );
        } catch (pgErr) {
          console.error("[RL-FABRIC] Cloud SQL insert failed:", (pgErr as Error).message?.substring(0, 120));
        }
      }
    } catch (err) {
      console.error("[RL-FABRIC] emit swallowed top-level error:", (err as Error).message?.substring(0, 120));
    }
  })();
}

// ─── Label back-fill (closes the loop) ────────────────────────────────────────
// Outcome-linked labels — first_request_at, first_review_at, gmv_30d — are what
// make registration_events training data. This is called by an admin endpoint
// (manual for MVP, cron later) and joins users → transactions → requests to
// back-fill labels on the registration row.

export async function recomputeRegistrationLabels(pool: Pool | null): Promise<{ updated: number }> {
  if (!pool) return { updated: 0 };
  try {
    const result = await pool.query(`
      UPDATE registration_events re
      SET
        first_request_at = sub.first_request_at,
        first_review_at = sub.first_review_at,
        gmv_30d = COALESCE(sub.gmv_30d, 0),
        churned_30d = CASE
          WHEN sub.first_request_at IS NULL
            AND re.created_at < NOW() - INTERVAL '30 days'
          THEN TRUE
          ELSE FALSE
        END
      FROM (
        SELECT
          u.id AS user_id,
          (SELECT MIN(r.created_at) FROM requests r WHERE r.user_id = u.id) AS first_request_at,
          (SELECT MIN(er.created_at) FROM expert_reviews er
            JOIN experts e ON e.id = er.expert_id WHERE e.user_id = u.id) AS first_review_at,
          (SELECT COALESCE(SUM(ct.amount * -1), 0)
             FROM credit_transactions ct
             WHERE ct.user_id = u.id
               AND ct.type NOT IN ('bonus','refund','admin_grant')
               AND ct.amount < 0
               AND ct.created_at <= u.created_at + INTERVAL '30 days'
          ) AS gmv_30d
        FROM users u
      ) sub
      WHERE re.user_id = sub.user_id
        AND re.outcome = 'created'
    `);
    return { updated: result.rowCount || 0 };
  } catch (err) {
    console.error("[RL-FABRIC] Label recompute failed:", (err as Error).message?.substring(0, 200));
    return { updated: 0 };
  }
}

// ─── Admin-facing funnel aggregate (for OB/AA dashboards) ────────────────────

export async function getRegistrationFunnel(pool: Pool | null, sinceHours: number = 24): Promise<any> {
  if (!pool) return { error: "Cloud SQL not configured" };
  try {
    const [byOutcome, byUtm, byRole, byFraud] = await Promise.all([
      pool.query(
        `SELECT outcome, COUNT(*) n
         FROM registration_events
         WHERE created_at >= NOW() - ($1 || ' hours')::interval
         GROUP BY outcome ORDER BY n DESC`,
        [String(sinceHours)]
      ),
      pool.query(
        `SELECT COALESCE(utm_source,'(direct)') utm_source, COUNT(*) attempts,
                SUM(CASE WHEN outcome='created' THEN 1 ELSE 0 END) created
         FROM registration_events
         WHERE created_at >= NOW() - ($1 || ' hours')::interval
         GROUP BY utm_source ORDER BY attempts DESC LIMIT 20`,
        [String(sinceHours)]
      ),
      pool.query(
        `SELECT intended_role, final_role, COUNT(*) n
         FROM registration_events
         WHERE created_at >= NOW() - ($1 || ' hours')::interval
         GROUP BY intended_role, final_role ORDER BY n DESC`,
        [String(sinceHours)]
      ),
      pool.query(
        `SELECT
            CASE
              WHEN predicted_fraud_score >= 0.7 THEN 'high'
              WHEN predicted_fraud_score >= 0.4 THEN 'medium'
              ELSE 'low'
            END AS fraud_bucket,
            COUNT(*) n
         FROM registration_events
         WHERE created_at >= NOW() - ($1 || ' hours')::interval
         GROUP BY fraud_bucket ORDER BY n DESC`,
        [String(sinceHours)]
      ),
    ]);
    return {
      sinceHours,
      policyVersion: REGISTRATION_POLICY_VERSION,
      byOutcome: byOutcome.rows,
      byUtmSource: byUtm.rows,
      byRole: byRole.rows,
      byFraudBucket: byFraud.rows,
    };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
