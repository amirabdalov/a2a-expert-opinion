import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { resolve } from "path";
import Database from "better-sqlite3";
import { Resend } from "resend";

// ─── Build 45.6.8 — Data Durability Hardening ─────────────────────────────────
// Implements trust-critical backup guarantees (per AA's requirements):
//   1. Per-env GCS prefix (UAT vs PROD) — isolated at the object-path level
//   3. Timestamped rolling snapshots outside the live path (`/snapshots/...`)
//   4. PRAGMA integrity_check + size/magic validation before every backup counts
//   6. Immediate (synchronous, awaited) backup available for destructive writes
//   7. Alert on repeated backup failures via Resend
//
// Note: GCS Object Versioning (point 1 from audit) and Cloud Scheduler hourly/daily
// snapshots (point 3) are infra — enabled/configured via the runbook, not code.
// ──────────────────────────────────────────────────────────────────────────────

const BUCKET = "a2a-global-data";
const GCS_PREFIX = process.env.GCS_PREFIX || "";
const OBJECT = `${GCS_PREFIX}db/data.db`;
const DB_PATH = resolve("data.db");

// Env label for logs/alerts: "uat/" → "UAT", "" → "PROD"
const ENV_LABEL = GCS_PREFIX.replace(/\/$/, "").toUpperCase() || "PROD";

// Resend client for failure alerts (uses same key as server/email.ts)
const resendClient = new Resend(process.env.RESEND_API_KEY || "re_PrjaSqsY_fdEew3xntXPQsouj46kysKRF");
const ALERT_TO = process.env.BACKUP_ALERT_EMAIL || "amir@a2a.global,oleg@a2a.global";
const ALERT_COOLDOWN_MS = 15 * 60_000; // don't spam — 15 min between alerts
let lastAlertAt = 0;

async function sendBackupAlert(subject: string, body: string): Promise<void> {
  if (Date.now() - lastAlertAt < ALERT_COOLDOWN_MS) return;
  lastAlertAt = Date.now();
  try {
    await resendClient.emails.send({
      from: "A2A Ops <ops@a2a.global>",
      to: ALERT_TO.split(",").map((s) => s.trim()),
      subject: `🚨 [${ENV_LABEL}] ${subject}`,
      html: `<pre style="font-family:monospace;white-space:pre-wrap;">${body}</pre>`,
    });
    console.error(`[DB-BACKUP] 📧 Alert email dispatched: ${subject}`);
  } catch (e) {
    console.error("[DB-BACKUP] ❌ Alert send failed:", e);
  }
}

// Build 45.6.10 (2026-04-25): The metadata token fetch was failing intermittently with a
// 3-second timeout and zero retries on both PROD and UAT, causing hourly "No GCP token"
// emails. The IAM is fine — the SA has roles/storage.admin on the bucket. The fetch just
// occasionally takes longer than 3s during cold-starts or scaling events.
//
// Fix: 10s timeout, 2 retries with exponential backoff, full error logging so future
// failures aren't silent. Cache the token for ~50 min (tokens are valid 60 min).
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getGcpToken(): Promise<string | null> {
  // Token cache — refresh 10 min before expiry
  if (cachedToken && Date.now() < cachedToken.expiresAt - 600_000) {
    return cachedToken.value;
  }

  const url = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
  let lastErr: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(10_000), // 10s, was 3s
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastErr = new Error(`metadata server returned HTTP ${res.status}: ${body.substring(0, 200)}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }
      const json = (await res.json()) as { access_token: string; expires_in?: number };
      const expiresIn = (json.expires_in || 3600) * 1000;
      cachedToken = { value: json.access_token, expiresAt: Date.now() + expiresIn };
      if (attempt > 1) console.log(`[GCP-TOKEN] Recovered on attempt ${attempt}`);
      return json.access_token;
    } catch (err: any) {
      lastErr = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  console.error(`[GCP-TOKEN] All 3 attempts failed. Last error:`, lastErr?.message || lastErr);
  return null;
}

let lastBackupSuccess = false;
let lastBackupAt = 0;
let backupAttempts = 0;
let consecutiveFailures = 0;

export function isBackupHealthy(): boolean {
  return lastBackupSuccess;
}
export function getBackupStats() {
  return { lastBackupSuccess, lastBackupAt, backupAttempts, consecutiveFailures, envLabel: ENV_LABEL, path: OBJECT };
}

/**
 * Validate the SQLite file on disk BEFORE we upload it:
 *   - file exists & non-trivial size
 *   - SQLite magic header
 *   - `PRAGMA integrity_check` returns `ok`
 * Returns null on success, error string on failure.
 */
function validateLocalDb(): string | null {
  if (!existsSync(DB_PATH)) return "data.db missing";
  let stats;
  try {
    stats = statSync(DB_PATH);
  } catch (e: any) {
    return `stat failed: ${e.message}`;
  }
  if (stats.size < 512) return `data.db too small (${stats.size} bytes) — likely empty/corrupt`;

  // SQLite magic header: "SQLite format 3\000"
  let header: Buffer;
  try {
    const fd = require("fs").openSync(DB_PATH, "r");
    header = Buffer.alloc(16);
    require("fs").readSync(fd, header, 0, 16, 0);
    require("fs").closeSync(fd);
  } catch (e: any) {
    return `header read failed: ${e.message}`;
  }
  if (header.toString("utf8", 0, 15) !== "SQLite format 3") return "invalid SQLite magic header";

  // PRAGMA integrity_check (open read-only to avoid lock contention)
  try {
    const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    const row = db.prepare("PRAGMA integrity_check(1)").get() as { integrity_check: string } | undefined;
    db.close();
    if (!row || row.integrity_check !== "ok") {
      return `integrity_check failed: ${row ? row.integrity_check : "no result"}`;
    }
  } catch (e: any) {
    return `integrity_check threw: ${e.message}`;
  }
  return null;
}

/**
 * Canonical backup: uploads data.db to gs://{BUCKET}/{GCS_PREFIX}db/data.db
 * Relies on GCS Object Versioning (enabled via runbook) so each overwrite
 * produces a restorable historical version.
 *
 * Refuses to upload if integrity_check fails — we'd rather have a stale
 * backup than overwrite a good one with garbage.
 */
export async function backupDatabase(): Promise<boolean> {
  try {
    const validationErr = validateLocalDb();
    if (validationErr) {
      consecutiveFailures++;
      lastBackupSuccess = false;
      console.error(`[DB-BACKUP] ❌ [${ENV_LABEL}] Integrity validation failed: ${validationErr}`);
      if (consecutiveFailures >= 3) {
        await sendBackupAlert(
          `Backup integrity check failed ${consecutiveFailures}×`,
          `Environment: ${ENV_LABEL}\nPath: gs://${BUCKET}/${OBJECT}\nReason: ${validationErr}\n\nData.db will NOT be uploaded until integrity is restored.\nLast successful backup: ${lastBackupAt ? new Date(lastBackupAt).toISOString() : "never"}`,
        );
      }
      return false;
    }

    const token = await getGcpToken();
    if (!token) {
      consecutiveFailures++;
      lastBackupSuccess = false;
      console.error(`[DB-BACKUP] ⚠️ [${ENV_LABEL}] No GCP token — backup skipped. User data WILL BE LOST on next deploy!`);
      if (consecutiveFailures >= 3) {
        await sendBackupAlert(
          "No GCP token — backups are failing",
          `Environment: ${ENV_LABEL}\nService cannot obtain metadata token. Check Cloud Run service account.`,
        );
      }
      return false;
    }

    const data = readFileSync(DB_PATH);
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(OBJECT)}`;
    backupAttempts++;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(data.length),
      },
      body: data,
    });
    if (res.ok) {
      lastBackupSuccess = true;
      lastBackupAt = Date.now();
      consecutiveFailures = 0;
      console.log(`[DB-BACKUP] ✅ [${ENV_LABEL}] ${data.length} bytes → gs://${BUCKET}/${OBJECT} (attempt #${backupAttempts})`);
      return true;
    } else {
      consecutiveFailures++;
      lastBackupSuccess = false;
      const body = await res.text();
      console.error(`[DB-BACKUP] ❌ [${ENV_LABEL}] FAILED HTTP ${res.status} (attempt #${backupAttempts}): ${body.substring(0, 500)}`);
      if (consecutiveFailures >= 3) {
        await sendBackupAlert(
          `Backup upload failed ${consecutiveFailures}× — HTTP ${res.status}`,
          `Environment: ${ENV_LABEL}\nPath: gs://${BUCKET}/${OBJECT}\nResponse: ${body.substring(0, 1000)}`,
        );
      }
      return false;
    }
  } catch (err: any) {
    consecutiveFailures++;
    lastBackupSuccess = false;
    console.error(`[DB-BACKUP] ❌ [${ENV_LABEL}] Exception:`, err);
    if (consecutiveFailures >= 3) {
      await sendBackupAlert(
        `Backup exception ${consecutiveFailures}×`,
        `Environment: ${ENV_LABEL}\nError: ${err?.message || String(err)}\nStack: ${err?.stack?.substring(0, 2000) || "n/a"}`,
      );
    }
    return false;
  }
}

/**
 * Restore data.db from the current (live) GCS version for this environment.
 * Called once at startup BEFORE opening the SQLite handle.
 */
export async function restoreDatabase(): Promise<void> {
  try {
    const token = await getGcpToken();
    if (!token) {
      console.log(`[DB-RESTORE] [${ENV_LABEL}] No GCP token, skipping restore`);
      return;
    }
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(OBJECT)}?alt=media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      if (res.status === 404) console.log(`[DB-RESTORE] [${ENV_LABEL}] No backup at gs://${BUCKET}/${OBJECT} — starting fresh`);
      else console.error(`[DB-RESTORE] [${ENV_LABEL}] HTTP ${res.status}`);
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(DB_PATH, buf);
    console.log(`[DB-RESTORE] ✅ [${ENV_LABEL}] ${buf.length} bytes ← gs://${BUCKET}/${OBJECT}`);
  } catch (err) {
    console.error(`[DB-RESTORE] [${ENV_LABEL}] Error:`, err);
  }
}

// ─── Debounced backup: 5s after last write (for bursty traffic) ──────────────
let backupTimer: ReturnType<typeof setTimeout> | null = null;
export function triggerBackup(): void {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => { void backupDatabase(); }, 5000);
}

/**
 * Synchronous, awaitable backup. Use after destructive writes where we
 * cannot accept a 5s loss window (admin deletes, refund, withdrawal
 * settlement). Caller must await.
 */
export async function backupDatabaseNow(reason?: string): Promise<boolean> {
  if (reason) console.log(`[DB-BACKUP] 🔒 Immediate backup — ${reason}`);
  return backupDatabase();
}

/**
 * Write an additional timestamped snapshot to a rolling /snapshots/ path.
 * These objects are NEVER overwritten — Cloud Scheduler also hits this
 * monthly / hourly path for long-term retention.
 */
export async function snapshotDatabase(kind: "manual" | "hourly" | "daily" = "manual"): Promise<boolean> {
  try {
    const validationErr = validateLocalDb();
    if (validationErr) { console.error(`[DB-SNAPSHOT] Skipped — ${validationErr}`); return false; }
    const token = await getGcpToken();
    if (!token) return false;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const snapObject = `${GCS_PREFIX}snapshots/${kind}/${ts}.db`;
    const data = readFileSync(DB_PATH);
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(snapObject)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(data.length),
      },
      body: data,
    });
    if (res.ok) {
      console.log(`[DB-SNAPSHOT] ✅ [${ENV_LABEL}] ${kind} → gs://${BUCKET}/${snapObject} (${data.length} bytes)`);
      return true;
    }
    console.error(`[DB-SNAPSHOT] ❌ HTTP ${res.status}`);
    return false;
  } catch (e) {
    console.error("[DB-SNAPSHOT] Exception:", e);
    return false;
  }
}

export function startPeriodicBackup(): void {
  const FAST_INTERVAL_MS = 10_000;
  const SLOW_INTERVAL_MS = 60_000;
  const FAST_PHASE_DURATION_MS = 5 * 60_000;

  let fastTimer: ReturnType<typeof setInterval> | null = setInterval(() => { void backupDatabase(); }, FAST_INTERVAL_MS);
  console.log(`[DB-BACKUP] [${ENV_LABEL}] Periodic backup started (fast phase: every 10s for 5min)`);

  setTimeout(() => {
    if (fastTimer) { clearInterval(fastTimer); fastTimer = null; }
    setInterval(() => { void backupDatabase(); }, SLOW_INTERVAL_MS);
    console.log(`[DB-BACKUP] [${ENV_LABEL}] Switched to slow backup phase (every 60s)`);
  }, FAST_PHASE_DURATION_MS);

  // Hourly in-process snapshot fallback (complements external Cloud Scheduler)
  setInterval(() => { void snapshotDatabase("hourly"); }, 60 * 60_000);
}
