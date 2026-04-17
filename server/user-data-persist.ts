import XLSX from "xlsx";
import { Resend } from "resend";
import pg from "pg";

const resend = new Resend(process.env.RESEND_API_KEY || "re_PrjaSqsY_fdEew3xntXPQsouj46kysKRF");
const COFOUNDER_EMAILS = ["amir@a2a.global", "oleg@a2a.global"];

// ─── Cloud SQL PostgreSQL (Layer 4) ───
const CLOUD_SQL_CONNECTION = "winter-jet-492110-g9:us-central1:a2a-global-db";
const PG_CONFIG = {
  user: "postgres",
  password: "A2A$ecureDB2026!",
  database: "a2a_production",
  // On Cloud Run, connect via Unix socket
  host: `/cloudsql/${CLOUD_SQL_CONNECTION}`,
};

let pgPool: pg.Pool | null = null;
let pgReady = false;

async function getPgPool(): Promise<pg.Pool | null> {
  if (pgPool && pgReady) return pgPool;

  // Try Unix socket first (Cloud Run), then public IP fallback
  const configs = [
    { ...PG_CONFIG, host: `/cloudsql/${CLOUD_SQL_CONNECTION}` },
    { user: "postgres", password: "A2A$ecureDB2026!", database: "a2a_production", host: "34.46.252.14", port: 5432 },
  ];

  for (const config of configs) {
    try {
      const pool = new pg.Pool({ ...config, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
      const client = await pool.connect();
      client.release();
      pgPool = pool;
      pgReady = true;
      const via = config.host?.startsWith('/') ? 'Unix socket' : `TCP ${config.host}`;
      console.log(`[CLOUD-SQL] ✅ Connected to PostgreSQL via ${via}`);
      return pgPool;
    } catch (err) {
      const via = config.host?.startsWith('/') ? 'Unix socket' : `TCP ${config.host}`;
      console.log(`[CLOUD-SQL] ${via} failed:`, (err as Error).message?.substring(0, 80));
    }
  }

  console.log("[CLOUD-SQL] Not available — all connection methods failed");
  pgPool = null;
  pgReady = false;
  return null;
}

async function ensurePgTables(pool: pg.Pool): Promise<void> {
  // OB-A: Create ALL tables in Cloud SQL for full persistence
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'client',
      company TEXT,
      credits INTEGER NOT NULL DEFAULT 5,
      account_type TEXT DEFAULT 'individual',
      wallet_balance INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      tour_completed INTEGER DEFAULT 0,
      login_count INTEGER DEFAULT 0,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS experts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      bio TEXT DEFAULT '',
      expertise TEXT DEFAULT '',
      credentials TEXT DEFAULT '',
      rating INTEGER DEFAULT 50,
      total_reviews INTEGER DEFAULT 0,
      verified INTEGER DEFAULT 0,
      categories TEXT DEFAULT '[]',
      availability INTEGER DEFAULT 1,
      hourly_rate INTEGER,
      response_time TEXT,
      rate_per_minute TEXT,
      rate_tier TEXT,
      education TEXT DEFAULT '',
      years_experience INTEGER DEFAULT 0,
      onboarding_complete INTEGER DEFAULT 0,
      verification_score INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expert_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      tier TEXT DEFAULT 'standard',
      status TEXT DEFAULT 'pending',
      credits_cost INTEGER DEFAULT 0,
      expert_response TEXT,
      service_type TEXT DEFAULT 'review',
      ai_response TEXT,
      attachments TEXT DEFAULT '[]',
      experts_needed INTEGER DEFAULT 1,
      instructions TEXT,
      llm_provider TEXT,
      llm_model TEXT,
      price_per_minute TEXT,
      price_tier TEXT,
      service_category TEXT,
      client_rating INTEGER,
      client_rating_comment TEXT,
      refunded INTEGER DEFAULT 0,
      followup_count INTEGER DEFAULT 0,
      followup_deadline TEXT,
      deadline TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS expert_reviews (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL,
      expert_id INTEGER,
      status TEXT DEFAULT 'pending',
      rating INTEGER,
      rating_comment TEXT,
      correct_points TEXT,
      incorrect_points TEXT,
      suggestions TEXT,
      deliverable TEXT,
      created_at TEXT,
      completed_at TEXT,
      invoiced INTEGER DEFAULT 0,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      type TEXT NOT NULL,
      stripe_payment_id TEXT,
      description TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      link TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS request_events (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      actor_id INTEGER,
      actor_name TEXT,
      message TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS withdrawals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expert_id INTEGER,
      amount_cents INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT,
      processed_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      expert_id INTEGER NOT NULL,
      invoice_number TEXT NOT NULL UNIQUE,
      total_amount INTEGER NOT NULL,
      platform_fee INTEGER NOT NULL,
      net_payout INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      line_items TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS verification_tests (
      id SERIAL PRIMARY KEY,
      expert_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      answers TEXT DEFAULT '[]',
      score INTEGER DEFAULT 0,
      passed INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS legal_acceptances (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      document_version TEXT DEFAULT 'April 2026',
      accepted_at TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS expert_verifications (
      id SERIAL PRIMARY KEY,
      expert_id INTEGER NOT NULL,
      passport_file_url TEXT,
      account_number TEXT,
      swift_code TEXT,
      bank_name TEXT,
      bank_address TEXT,
      verified_by_admin INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id SERIAL PRIMARY KEY,
      expert_id INTEGER NOT NULL,
      amount TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      admin_notes TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);
  // Add columns that may be missing on existing Cloud SQL tables
  const migrations = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_completed INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0",
    "ALTER TABLE experts ADD COLUMN IF NOT EXISTS availability INTEGER DEFAULT 1",
    "ALTER TABLE experts ADD COLUMN IF NOT EXISTS hourly_rate INTEGER",
    "ALTER TABLE experts ADD COLUMN IF NOT EXISTS response_time TEXT",
    "ALTER TABLE experts ADD COLUMN IF NOT EXISTS verification_score INTEGER",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS expert_response TEXT",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS ai_response TEXT",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments TEXT DEFAULT '[]'",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS experts_needed INTEGER DEFAULT 1",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS instructions TEXT",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS llm_provider TEXT",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS llm_model TEXT",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS price_per_minute TEXT",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS price_tier TEXT",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS service_category TEXT",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS client_rating INTEGER",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS client_rating_comment TEXT",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS refunded INTEGER DEFAULT 0",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS followup_count INTEGER DEFAULT 0",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS followup_deadline TEXT",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS deadline TEXT",
    // Build 35: Add updated_at to all tables, created_at to experts/admins/legal_acceptances
    "ALTER TABLE experts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE expert_reviews ADD COLUMN IF NOT EXISTS updated_at TEXT",
    "ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TEXT",
    "ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS updated_at TEXT",
    "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TEXT",
    "ALTER TABLE request_events ADD COLUMN IF NOT EXISTS updated_at TEXT",
    "ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS updated_at TEXT",
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TEXT",
    "ALTER TABLE verification_tests ADD COLUMN IF NOT EXISTS updated_at TEXT",
    "ALTER TABLE legal_acceptances ADD COLUMN IF NOT EXISTS created_at TEXT",
    "ALTER TABLE legal_acceptances ADD COLUMN IF NOT EXISTS updated_at TEXT",
    // Backfill NULLs in Cloud SQL
    "UPDATE users SET created_at = NOW() WHERE created_at IS NULL",
    "UPDATE users SET updated_at = NOW() WHERE updated_at IS NULL",
    "UPDATE experts SET created_at = NOW() WHERE created_at IS NULL",
    "UPDATE experts SET updated_at = NOW() WHERE updated_at IS NULL",
    "UPDATE legal_acceptances SET created_at = accepted_at WHERE created_at IS NULL",
    "UPDATE legal_acceptances SET updated_at = accepted_at WHERE updated_at IS NULL",
  ];
  for (const m of migrations) {
    try { await pool.query(m); } catch {}
  }
  console.log("[CLOUD-SQL] All tables ensured (full persistence)");
}

export async function initCloudSql(): Promise<void> {
  const pool = await getPgPool();
  if (pool) await ensurePgTables(pool);
}

export async function writeUserToCloudSql(user: {
  id: number; name: string; email: string; role: string;
  company?: string | null; credits: number;
  walletBalance?: number; active?: number; loginCount?: number; tourCompleted?: number;
  utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null;
}): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO users (id, name, email, role, company, credits, wallet_balance, active, login_count, tour_completed, utm_source, utm_medium, utm_campaign, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role,
         company = EXCLUDED.company, credits = EXCLUDED.credits,
         wallet_balance = EXCLUDED.wallet_balance, active = EXCLUDED.active,
         login_count = EXCLUDED.login_count, tour_completed = EXCLUDED.tour_completed,
         utm_source = EXCLUDED.utm_source, utm_medium = EXCLUDED.utm_medium,
         utm_campaign = EXCLUDED.utm_campaign, updated_at = NOW()`,
      [user.id, user.name, user.email, user.role, user.company || null, user.credits,
       user.walletBalance ?? 0, user.active ?? 1, user.loginCount ?? 0, user.tourCompleted ?? 0,
       user.utmSource || null, user.utmMedium || null, user.utmCampaign || null]
    );
  } catch (err) {
    console.error("[CLOUD-SQL] ❌ User write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function writeExpertToCloudSql(expert: {
  id: number; userId: number; bio: string; expertise: string; credentials: string;
  rating: number; totalReviews: number; verified: number; categories: string;
  rateTier?: string | null; ratePerMinute?: string | null;
  education: string; yearsExperience: number; onboardingComplete: number;
  createdAt?: string | null; updatedAt?: string | null;
}): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO experts (id, user_id, bio, expertise, credentials, rating, total_reviews, verified, categories, rate_per_minute, rate_tier, education, years_experience, onboarding_complete, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
       ON CONFLICT (id) DO UPDATE SET
         bio=EXCLUDED.bio, expertise=EXCLUDED.expertise, credentials=EXCLUDED.credentials,
         rating=EXCLUDED.rating, total_reviews=EXCLUDED.total_reviews, verified=EXCLUDED.verified,
         categories=EXCLUDED.categories, rate_per_minute=EXCLUDED.rate_per_minute,
         rate_tier=EXCLUDED.rate_tier, education=EXCLUDED.education,
         years_experience=EXCLUDED.years_experience, onboarding_complete=EXCLUDED.onboarding_complete,
         updated_at=NOW()`,
      [expert.id, expert.userId, expert.bio, expert.expertise, expert.credentials,
       expert.rating, expert.totalReviews, expert.verified, expert.categories,
       expert.ratePerMinute || null, expert.rateTier || null, expert.education,
       expert.yearsExperience, expert.onboardingComplete, expert.createdAt || new Date().toISOString()]
    );
    console.log(`[CLOUD-SQL] ✅ Expert ${expert.id} synced`);
  } catch (err) {
    console.error("[CLOUD-SQL] ❌ Expert write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function writeRequestToCloudSql(request: {
  id: number; userId: number; expertId?: number | null; title: string;
  description?: string | null; category: string; tier: string;
  status: string; creditsCost: number; serviceType: string;
  expertResponse?: string | null; aiResponse?: string | null; attachments?: string | null;
  clientRating?: number | null; clientRatingComment?: string | null;
  refunded?: number | null; priceTier?: string | null;
  followupCount?: number; followupDeadline?: string | null; deadline?: string | null;
  createdAt?: string | null; updatedAt?: string | null;
}): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO requests (id, user_id, expert_id, title, description, category, tier, status, credits_cost, service_type, expert_response, ai_response, attachments, client_rating, client_rating_comment, refunded, price_tier, followup_count, followup_deadline, deadline, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW())
       ON CONFLICT (id) DO UPDATE SET
         expert_id=EXCLUDED.expert_id, status=EXCLUDED.status, credits_cost=EXCLUDED.credits_cost,
         expert_response=EXCLUDED.expert_response, ai_response=EXCLUDED.ai_response,
         attachments=EXCLUDED.attachments, client_rating=EXCLUDED.client_rating,
         client_rating_comment=EXCLUDED.client_rating_comment, refunded=EXCLUDED.refunded,
         price_tier=EXCLUDED.price_tier, followup_count=EXCLUDED.followup_count,
         followup_deadline=EXCLUDED.followup_deadline, deadline=EXCLUDED.deadline,
         updated_at=NOW()`,
      [request.id, request.userId, request.expertId || null, request.title,
       request.description || null, request.category, request.tier,
       request.status, request.creditsCost, request.serviceType,
       request.expertResponse || null, request.aiResponse || null, request.attachments || '[]',
       request.clientRating || null, request.clientRatingComment || null,
       request.refunded || 0, request.priceTier || null,
       request.followupCount || 0, request.followupDeadline || null, request.deadline || null,
       request.createdAt || new Date().toISOString()]
    );
  } catch (err) {
    console.error("[CLOUD-SQL] ❌ Request write failed:", (err as Error).message?.substring(0, 100));
  }
}

// ─── OB-A: Write functions for ALL remaining tables ───

export async function writeExpertReviewToCloudSql(r: any): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO expert_reviews (id, request_id, expert_id, status, rating, rating_comment, correct_points, incorrect_points, suggestions, deliverable, created_at, completed_at, invoiced, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         status=EXCLUDED.status, rating=EXCLUDED.rating, rating_comment=EXCLUDED.rating_comment,
         correct_points=EXCLUDED.correct_points, incorrect_points=EXCLUDED.incorrect_points,
         suggestions=EXCLUDED.suggestions, deliverable=EXCLUDED.deliverable,
         completed_at=EXCLUDED.completed_at, invoiced=EXCLUDED.invoiced,
         updated_at=EXCLUDED.updated_at`,
      [r.id, r.requestId, r.expertId || null, r.status, r.rating || null,
       r.ratingComment || null, r.correctPoints || null, r.incorrectPoints || null,
       r.suggestions || null, r.deliverable || null, r.createdAt || null, r.completedAt || null, r.invoiced || 0,
       r.updatedAt || new Date().toISOString()]
    );
  } catch (err) {
    console.error("[CLOUD-SQL] ExpertReview write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function writeMessageToCloudSql(m: any): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO messages (id, request_id, role, content, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content, updated_at=EXCLUDED.updated_at`,
      [m.id, m.requestId, m.role, m.content, m.createdAt || null, m.updatedAt || new Date().toISOString()]
    );
  } catch (err) {
    console.error("[CLOUD-SQL] Message write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function writeNotificationToCloudSql(n: any): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO notifications (id, user_id, title, message, read, link, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET read=EXCLUDED.read, updated_at=EXCLUDED.updated_at`,
      [n.id, n.userId, n.title, n.message, n.read || 0, n.link || null, n.createdAt || null, n.updatedAt || new Date().toISOString()]
    );
  } catch (err) {
    console.error("[CLOUD-SQL] Notification write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function writeRequestEventToCloudSql(e: any): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO request_events (id, request_id, type, actor_id, actor_name, message, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [e.id, e.requestId, e.type, e.actorId || null, e.actorName || null, e.message || null, e.createdAt || null, e.updatedAt || new Date().toISOString()]
    );
  } catch (err) {
    console.error("[CLOUD-SQL] RequestEvent write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function writeWalletTransactionToCloudSql(t: any): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO wallet_transactions (id, user_id, amount_cents, type, stripe_payment_id, description, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [t.id, t.userId, t.amountCents, t.type, t.stripePaymentId || null, t.description || null, t.createdAt || null, t.updatedAt || new Date().toISOString()]
    );
  } catch (err) {
    console.error("[CLOUD-SQL] WalletTx write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function writeWithdrawalToCloudSql(w: any): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO withdrawals (id, user_id, expert_id, amount_cents, status, created_at, processed_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, processed_at=EXCLUDED.processed_at, updated_at=EXCLUDED.updated_at`,
      [w.id, w.userId, w.expertId || null, w.amountCents, w.status, w.createdAt || null, w.processedAt || null, w.updatedAt || new Date().toISOString()]
    );
  } catch (err) {
    console.error("[CLOUD-SQL] Withdrawal write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function writeInvoiceToCloudSql(inv: any): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO invoices (id, expert_id, invoice_number, total_amount, platform_fee, net_payout, status, line_items, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, updated_at=EXCLUDED.updated_at`,
      [inv.id, inv.expertId, inv.invoiceNumber, inv.totalAmount, inv.platformFee, inv.netPayout, inv.status, inv.lineItems, inv.createdAt || null, inv.updatedAt || new Date().toISOString()]
    );
  } catch (err) {
    console.error("[CLOUD-SQL] Invoice write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function writeVerificationTestToCloudSql(t: any): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO verification_tests (id, expert_id, category, answers, score, passed, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [t.id, t.expertId, t.category, t.answers, t.score, t.passed, t.createdAt || null, t.updatedAt || new Date().toISOString()]
    );
  } catch (err) {
    console.error("[CLOUD-SQL] VerificationTest write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function writeExpertVerificationToCloudSql(v: any): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO expert_verifications (id, expert_id, passport_file_url, account_number, swift_code, bank_name, bank_address, verified_by_admin, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         passport_file_url=EXCLUDED.passport_file_url, account_number=EXCLUDED.account_number,
         swift_code=EXCLUDED.swift_code, bank_name=EXCLUDED.bank_name, bank_address=EXCLUDED.bank_address,
         verified_by_admin=EXCLUDED.verified_by_admin, updated_at=EXCLUDED.updated_at`,
      [v.id, v.expertId, v.passportFileUrl || null, v.accountNumber || null,
       v.swiftCode || null, v.bankName || null, v.bankAddress || null,
       v.verifiedByAdmin || 0, v.createdAt || null, v.updatedAt || null]
    );
  } catch (err) {
    console.error("[CLOUD-SQL] ExpertVerification write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function writeWithdrawalRequestToCloudSql(w: any): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO withdrawal_requests (id, expert_id, amount, invoice_number, status, admin_notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, admin_notes=EXCLUDED.admin_notes, updated_at=EXCLUDED.updated_at`,
      [w.id, w.expertId, w.amount, w.invoiceNumber, w.status, w.adminNotes || null, w.createdAt || null, w.updatedAt || null]
    );
  } catch (err) {
    console.error("[CLOUD-SQL] WithdrawalRequest write failed:", (err as Error).message?.substring(0, 100));
  }
}

// ─── Restore from Cloud SQL to SQLite on startup ───
export async function restoreFromCloudSql(sqliteDb: any): Promise<void> {
  const pool = await getPgPool();
  if (!pool) {
    console.log("[RESTORE] Cloud SQL not available — skipping restore, using seed data only");
    return;
  }

  try {
    // Restore users
    const usersResult = await pool.query("SELECT * FROM users ORDER BY id");
    const pgUsers = usersResult.rows;
    console.log(`[RESTORE] Found ${pgUsers.length} users in Cloud SQL`);

    for (const u of pgUsers) {
      try {
        sqliteDb.prepare(`
          INSERT OR REPLACE INTO users (id, username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed, photo, login_count, utm_source, utm_medium, utm_campaign, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          u.id,
          u.email || '',       // use email as username if not present
          '',                   // password — Cloud SQL doesn't store it
          u.name,
          u.email,
          u.role || 'client',
          u.credits ?? 5,
          u.company || null,
          u.account_type || 'individual',
          u.wallet_balance ?? 0,
          u.active ?? 1,
          u.tour_completed ?? 0,
          null,                 // photo
          u.login_count ?? 0,
          u.utm_source || null,
          u.utm_medium || null,
          u.utm_campaign || null,
          u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
          u.updated_at ? new Date(u.updated_at).toISOString() : new Date().toISOString()
        );
      } catch (err) {
        console.error(`[RESTORE] User ${u.id} insert failed:`, (err as Error).message?.substring(0, 80));
      }
    }
    console.log(`[RESTORE] Restored ${pgUsers.length} users`);

    // Restore experts
    const expertsResult = await pool.query("SELECT * FROM experts ORDER BY id");
    const pgExperts = expertsResult.rows;
    for (const e of pgExperts) {
      try {
        sqliteDb.prepare(`
          INSERT OR REPLACE INTO experts (id, user_id, bio, expertise, credentials, rating, total_reviews, verified, categories, availability, hourly_rate, response_time, education, years_experience, onboarding_complete, verification_score, rate_per_minute, rate_tier, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          e.id,
          e.user_id,
          e.bio || '',
          e.expertise || '',
          e.credentials || '',
          e.rating ?? 50,
          e.total_reviews ?? 0,
          e.verified ?? 0,
          e.categories || '[]',
          1,                     // availability default
          null,                  // hourly_rate
          null,                  // response_time
          e.education || '',
          e.years_experience ?? 0,
          e.onboarding_complete ?? 0,
          null,                  // verification_score
          e.rate_per_minute || null,
          e.rate_tier || null,
          e.created_at ? new Date(e.created_at).toISOString() : new Date().toISOString(),
          e.updated_at ? new Date(e.updated_at).toISOString() : new Date().toISOString()
        );
      } catch (err) {
        console.error(`[RESTORE] Expert ${e.id} insert failed:`, (err as Error).message?.substring(0, 80));
      }
    }
    console.log(`[RESTORE] Restored ${pgExperts.length} experts`);

    // Restore requests (ALL fields)
    const requestsResult = await pool.query("SELECT * FROM requests ORDER BY id");
    const pgRequests = requestsResult.rows;
    for (const r of pgRequests) {
      try {
        sqliteDb.prepare(`
          INSERT OR REPLACE INTO requests (id, user_id, expert_id, title, description, category, tier, status, credits_cost, service_type, expert_response, ai_response, attachments, client_rating, client_rating_comment, refunded, price_tier, followup_count, followup_deadline, deadline, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          r.id, r.user_id, r.expert_id || null, r.title, r.description || '',
          r.category, r.tier || 'standard', r.status || 'pending', r.credits_cost ?? 0,
          r.service_type || 'review', r.expert_response || null, r.ai_response || null,
          r.attachments || '[]', r.client_rating || null, r.client_rating_comment || null,
          r.refunded || 0, r.price_tier || null, r.followup_count || 0,
          r.followup_deadline || null, r.deadline || null,
          r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          r.updated_at ? new Date(r.updated_at).toISOString() : null
        );
      } catch (err) {
        console.error(`[RESTORE] Request ${r.id} insert failed:`, (err as Error).message?.substring(0, 80));
      }
    }
    console.log(`[RESTORE] Restored ${pgRequests.length} requests`);

    // Restore credit_transactions
    const txResult = await pool.query("SELECT * FROM credit_transactions ORDER BY id");
    const pgTx = txResult.rows;
    for (const t of pgTx) {
      try {
        sqliteDb.prepare(`
          INSERT OR REPLACE INTO credit_transactions (id, user_id, amount, type, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          t.id,
          t.user_id,
          t.amount,
          t.type,
          t.description || '',
          t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
          t.updated_at ? new Date(t.updated_at).toISOString() : null
        );
      } catch (err) {
        console.error(`[RESTORE] Transaction ${t.id} insert failed:`, (err as Error).message?.substring(0, 80));
      }
    }
    console.log(`[RESTORE] Restored ${pgTx.length} credit transactions`);

    // OB-A: Restore ALL remaining tables

    // Restore expert_reviews
    try {
      const result = await pool.query("SELECT * FROM expert_reviews ORDER BY id");
      for (const r of result.rows) {
        try {
          sqliteDb.prepare(`INSERT OR REPLACE INTO expert_reviews (id, request_id, expert_id, status, rating, rating_comment, correct_points, incorrect_points, suggestions, deliverable, created_at, completed_at, invoiced, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
            r.id, r.request_id, r.expert_id || null, r.status || 'pending', r.rating || null,
            r.rating_comment || null, r.correct_points || null, r.incorrect_points || null,
            r.suggestions || null, r.deliverable || null, r.created_at || null, r.completed_at || null, r.invoiced || 0,
            r.updated_at || null
          );
        } catch {}
      }
      console.log(`[RESTORE] Restored ${result.rows.length} expert_reviews`);
    } catch (err) { console.error("[RESTORE] expert_reviews failed:", (err as Error).message?.substring(0, 80)); }

    // Restore messages
    try {
      const result = await pool.query("SELECT * FROM messages ORDER BY id");
      for (const m of result.rows) {
        try {
          sqliteDb.prepare(`INSERT OR REPLACE INTO messages (id, request_id, role, content, created_at, updated_at) VALUES (?,?,?,?,?,?)`).run(
            m.id, m.request_id, m.role, m.content, m.created_at || null, m.updated_at || null
          );
        } catch {}
      }
      console.log(`[RESTORE] Restored ${result.rows.length} messages`);
    } catch (err) { console.error("[RESTORE] messages failed:", (err as Error).message?.substring(0, 80)); }

    // Restore wallet_transactions
    try {
      const result = await pool.query("SELECT * FROM wallet_transactions ORDER BY id");
      for (const t of result.rows) {
        try {
          sqliteDb.prepare(`INSERT OR REPLACE INTO wallet_transactions (id, user_id, amount_cents, type, stripe_payment_id, description, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(
            t.id, t.user_id, t.amount_cents, t.type, t.stripe_payment_id || null, t.description || null, t.created_at || null, t.updated_at || null
          );
        } catch {}
      }
      console.log(`[RESTORE] Restored ${result.rows.length} wallet_transactions`);
    } catch (err) { console.error("[RESTORE] wallet_transactions failed:", (err as Error).message?.substring(0, 80)); }

    // Restore notifications
    try {
      const result = await pool.query("SELECT * FROM notifications ORDER BY id");
      for (const n of result.rows) {
        try {
          sqliteDb.prepare(`INSERT OR REPLACE INTO notifications (id, user_id, title, message, read, link, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(
            n.id, n.user_id, n.title, n.message, n.read || 0, n.link || null, n.created_at || null, n.updated_at || null
          );
        } catch {}
      }
      console.log(`[RESTORE] Restored ${result.rows.length} notifications`);
    } catch (err) { console.error("[RESTORE] notifications failed:", (err as Error).message?.substring(0, 80)); }

    // Restore request_events
    try {
      const result = await pool.query("SELECT * FROM request_events ORDER BY id");
      for (const e of result.rows) {
        try {
          sqliteDb.prepare(`INSERT OR REPLACE INTO request_events (id, request_id, type, actor_id, actor_name, message, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(
            e.id, e.request_id, e.type, e.actor_id || null, e.actor_name || null, e.message || null, e.created_at || null, e.updated_at || null
          );
        } catch {}
      }
      console.log(`[RESTORE] Restored ${result.rows.length} request_events`);
    } catch (err) { console.error("[RESTORE] request_events failed:", (err as Error).message?.substring(0, 80)); }

    // Restore withdrawals
    try {
      const result = await pool.query("SELECT * FROM withdrawals ORDER BY id");
      for (const w of result.rows) {
        try {
          sqliteDb.prepare(`INSERT OR REPLACE INTO withdrawals (id, user_id, expert_id, amount_cents, status, created_at, processed_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(
            w.id, w.user_id, w.expert_id || null, w.amount_cents, w.status, w.created_at || null, w.processed_at || null, w.updated_at || null
          );
        } catch {}
      }
      console.log(`[RESTORE] Restored ${result.rows.length} withdrawals`);
    } catch (err) { console.error("[RESTORE] withdrawals failed:", (err as Error).message?.substring(0, 80)); }

    // Restore invoices
    try {
      const result = await pool.query("SELECT * FROM invoices ORDER BY id");
      for (const inv of result.rows) {
        try {
          sqliteDb.prepare(`INSERT OR REPLACE INTO invoices (id, expert_id, invoice_number, total_amount, platform_fee, net_payout, status, line_items, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
            inv.id, inv.expert_id, inv.invoice_number, inv.total_amount, inv.platform_fee, inv.net_payout, inv.status, inv.line_items, inv.created_at || null, inv.updated_at || null
          );
        } catch {}
      }
      console.log(`[RESTORE] Restored ${result.rows.length} invoices`);
    } catch (err) { console.error("[RESTORE] invoices failed:", (err as Error).message?.substring(0, 80)); }

    // Restore verification_tests
    try {
      const result = await pool.query("SELECT * FROM verification_tests ORDER BY id");
      for (const t of result.rows) {
        try {
          sqliteDb.prepare(`INSERT OR REPLACE INTO verification_tests (id, expert_id, category, answers, score, passed, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(
            t.id, t.expert_id, t.category, t.answers || '[]', t.score || 0, t.passed || 0, t.created_at || null, t.updated_at || null
          );
        } catch {}
      }
      console.log(`[RESTORE] Restored ${result.rows.length} verification_tests`);
    } catch (err) { console.error("[RESTORE] verification_tests failed:", (err as Error).message?.substring(0, 80)); }

    // Restore legal_acceptances
    try {
      const result = await pool.query("SELECT * FROM legal_acceptances ORDER BY id");
      for (const l of result.rows) {
        try {
          sqliteDb.prepare(`INSERT OR REPLACE INTO legal_acceptances (id, user_id, document_type, document_version, accepted_at, ip_address, user_agent, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).run(
            l.id, l.user_id, l.document_type, l.document_version || 'April 2026', l.accepted_at || null, l.ip_address || null, l.user_agent || null,
            l.created_at || l.accepted_at || null, l.updated_at || l.accepted_at || null
          );
        } catch {}
      }
      console.log(`[RESTORE] Restored ${result.rows.length} legal_acceptances`);
    } catch (err) { console.error("[RESTORE] legal_acceptances failed:", (err as Error).message?.substring(0, 80)); }

    // Restore expert_verifications
    try {
      const result = await pool.query("SELECT * FROM expert_verifications ORDER BY id");
      for (const v of result.rows) {
        try {
          sqliteDb.prepare(`INSERT OR REPLACE INTO expert_verifications (id, expert_id, passport_file_url, account_number, swift_code, bank_name, bank_address, verified_by_admin, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
            v.id, v.expert_id, v.passport_file_url || null, v.account_number || null,
            v.swift_code || null, v.bank_name || null, v.bank_address || null,
            v.verified_by_admin || 0, v.created_at || null, v.updated_at || null
          );
        } catch {}
      }
      console.log(`[RESTORE] Restored ${result.rows.length} expert_verifications`);
    } catch (err) { console.error("[RESTORE] expert_verifications failed:", (err as Error).message?.substring(0, 80)); }

    // Restore withdrawal_requests
    try {
      const result = await pool.query("SELECT * FROM withdrawal_requests ORDER BY id");
      for (const w of result.rows) {
        try {
          sqliteDb.prepare(`INSERT OR REPLACE INTO withdrawal_requests (id, expert_id, amount, invoice_number, status, admin_notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(
            w.id, w.expert_id, w.amount, w.invoice_number, w.status, w.admin_notes || null, w.created_at || null, w.updated_at || null
          );
        } catch {}
      }
      console.log(`[RESTORE] Restored ${result.rows.length} withdrawal_requests`);
    } catch (err) { console.error("[RESTORE] withdrawal_requests failed:", (err as Error).message?.substring(0, 80)); }

    // Verify
    const countResult = sqliteDb.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
    console.log(`[RESTORE] ✅ Complete — SQLite now has ${countResult.cnt} users`);
  } catch (err) {
    console.error("[RESTORE] ❌ Cloud SQL restore failed:", (err as Error).message);
  }
}

// ─── Write credit transaction to Cloud SQL ───
export async function writeCreditTransactionToCloudSql(tx: {
  id?: number; userId: number; amount: number; type: string; description: string;
}): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    if (tx.id) {
      await pool.query(
        `INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           amount = EXCLUDED.amount, type = EXCLUDED.type, description = EXCLUDED.description,
           updated_at = NOW()`,
        [tx.id, tx.userId, tx.amount, tx.type, tx.description]
      );
    } else {
      await pool.query(
        `INSERT INTO credit_transactions (user_id, amount, type, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [tx.userId, tx.amount, tx.type, tx.description]
      );
    }
  } catch (err) {
    console.error("[CLOUD-SQL] Credit tx write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function syncAllToCloudSql(allUsers: any[], allExperts: any[], allRequests: any[], extras?: {
  reviews?: any[]; messages?: any[]; notifications?: any[]; events?: any[];
  walletTx?: any[]; withdrawals?: any[]; invoices?: any[]; verificationTests?: any[];
  expertVerifications?: any[]; withdrawalRequests?: any[];
}): Promise<void> {
  const pool = await getPgPool();
  if (!pool) return;
  console.log(`[CLOUD-SQL] Full sync: ${allUsers.length} users, ${allExperts.length} experts, ${allRequests.length} requests`);
  for (const u of allUsers) {
    await writeUserToCloudSql(u).catch(() => {});
  }
  for (const e of allExperts) {
    await writeExpertToCloudSql(e).catch(() => {});
  }
  for (const r of allRequests) {
    await writeRequestToCloudSql(r).catch(() => {});
  }
  // OB-A: Sync all remaining tables
  if (extras) {
    for (const r of (extras.reviews || [])) { await writeExpertReviewToCloudSql(r).catch(() => {}); }
    for (const m of (extras.messages || [])) { await writeMessageToCloudSql(m).catch(() => {}); }
    for (const n of (extras.notifications || [])) { await writeNotificationToCloudSql(n).catch(() => {}); }
    for (const e of (extras.events || [])) { await writeRequestEventToCloudSql(e).catch(() => {}); }
    for (const t of (extras.walletTx || [])) { await writeWalletTransactionToCloudSql(t).catch(() => {}); }
    for (const w of (extras.withdrawals || [])) { await writeWithdrawalToCloudSql(w).catch(() => {}); }
    for (const inv of (extras.invoices || [])) { await writeInvoiceToCloudSql(inv).catch(() => {}); }
    for (const t of (extras.verificationTests || [])) { await writeVerificationTestToCloudSql(t).catch(() => {}); }
    for (const v of (extras.expertVerifications || [])) { await writeExpertVerificationToCloudSql(v).catch(() => {}); }
    for (const w of (extras.withdrawalRequests || [])) { await writeWithdrawalRequestToCloudSql(w).catch(() => {}); }
  }
  console.log("[CLOUD-SQL] ✅ Full sync complete");
}

// ─── BigQuery Dual-Write ───
async function getGcpToken(): Promise<string | null> {
  try {
    const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const json = await res.json() as { access_token: string };
    return json.access_token;
  } catch { return null; }
}

export async function writeUserToBigQuery(user: {
  id: number; name: string; email: string; role: string;
  company?: string | null; credits: number; createdAt?: string;
  utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null;
}) {
  try {
    const token = await getGcpToken();
    if (!token) {
      console.log("[BQ] No GCP token, skipping BigQuery write (local dev)");
      return;
    }
    const PROJECT = "winter-jet-492110-g9";
    const DATASET = "a2a_analytics";
    const TABLE = "users_persistent";

    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT}/datasets/${DATASET}/tables/${TABLE}/insertAll`;

    const row = {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company || "",
      credits: user.credits,
      utm_source: user.utmSource || "",
      utm_medium: user.utmMedium || "",
      utm_campaign: user.utmCampaign || "",
      registered_at: user.createdAt || new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rows: [{ insertId: `user_${user.id}_${Date.now()}`, json: row }],
      }),
    });

    if (resp.ok) {
      console.log(`[BQ] ✅ User ${user.email} written to BigQuery`);
    } else {
      const text = await resp.text();
      console.error(`[BQ] ❌ BigQuery write failed: ${resp.status} — ${text.substring(0, 300)}`);
      // If table doesn't exist, try to create it
      if (resp.status === 404 && text.includes("Not found: Table")) {
        await createBigQueryTable(token, PROJECT, DATASET, TABLE);
        // Retry
        const retry = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ rows: [{ insertId: `user_${user.id}_${Date.now()}`, json: row }] }),
        });
        if (retry.ok) console.log(`[BQ] ✅ User ${user.email} written after table creation`);
        else console.error(`[BQ] ❌ Retry failed: ${retry.status}`);
      }
    }
  } catch (err) {
    console.error("[BQ] Exception:", err);
  }
}

async function createBigQueryTable(token: string, project: string, dataset: string, table: string) {
  const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${project}/datasets/${dataset}/tables`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tableReference: { projectId: project, datasetId: dataset, tableId: table },
      schema: {
        fields: [
          { name: "user_id", type: "INTEGER" },
          { name: "name", type: "STRING" },
          { name: "email", type: "STRING" },
          { name: "role", type: "STRING" },
          { name: "company", type: "STRING" },
          { name: "credits", type: "INTEGER" },
          { name: "utm_source", type: "STRING" },
          { name: "utm_medium", type: "STRING" },
          { name: "utm_campaign", type: "STRING" },
          { name: "registered_at", type: "TIMESTAMP" },
          { name: "last_synced_at", type: "TIMESTAMP" },
        ],
      },
    }),
  });
  if (resp.ok) console.log(`[BQ] Created table ${dataset}.${table}`);
  else console.error(`[BQ] Table creation failed: ${resp.status} ${await resp.text()}`);
}

// ─── Excel Email Report ───
export async function sendUserRegistrationEmail(user: {
  id: number; name: string; email: string; role: string;
  company?: string | null; credits: number;
}) {
  try {
    // Create Excel workbook with single user
    const wb = XLSX.utils.book_new();
    const data = [
      ["User ID", "Name", "Email", "Role", "Company", "Credits", "Registered At"],
      [user.id, user.name, user.email, user.role, user.company || "", user.credits, new Date().toISOString()],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 8 }, { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, "New Registration");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const roleLabel = user.role === "expert" ? "Expert" : "Client";

    await resend.emails.send({
      from: "A2A Global <noreply@a2a.global>",
      to: COFOUNDER_EMAILS,
      subject: `🆕 New ${roleLabel} Registration — ${user.name} (${user.email})`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
          <div style="text-align:center;padding:15px;border-bottom:2px solid #0F3DD1;">
            <img src="https://a2a.global/a2a-blue-logo.svg" alt="A2A Global" height="36" />
          </div>
          <h2 style="color:#0F3DD1;margin-top:20px;">New ${roleLabel} Registration</h2>
          <table style="width:100%;border-collapse:collapse;margin:15px 0;">
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${user.name}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${user.email}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Role</td><td style="padding:8px;border-bottom:1px solid #eee;">${roleLabel}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Company</td><td style="padding:8px;border-bottom:1px solid #eee;">${user.company || "—"}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Credits</td><td style="padding:8px;border-bottom:1px solid #eee;">${user.credits}</td></tr>
          </table>
          <p style="color:#666;font-size:13px;">Excel file attached. View all users in the <a href="https://a2a.global/#/admin/login" style="color:#0F3DD1;">Admin Panel</a>.</p>
        </div>
      `,
      attachments: [{
        filename: `A2A_New_${roleLabel}_${user.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`,
        content: buffer.toString("base64"),
      }],
    });
    console.log(`[EMAIL] ✅ Registration email sent for ${user.email}`);
  } catch (err) {
    console.error("[EMAIL] ❌ Registration email failed:", err);
  }
}

// ─── Full User Data Dump (daily or on-demand) ───
export async function sendFullUserDataEmail(allUsers: Array<{
  id: number; name: string; email: string; role: string;
  company?: string | null; credits: number; active: number;
}>, allExperts: Array<{
  id: number; userId: number; bio: string; expertise: string;
  credentials: string; rating: number; totalReviews: number;
  verified: number; rateTier?: string | null; ratePerMinute?: string | null;
}>) {
  try {
    const wb = XLSX.utils.book_new();

    // Users sheet
    const userData = [
      ["User ID", "Name", "Email", "Role", "Company", "Credits", "Active"],
      ...allUsers.map(u => [u.id, u.name, u.email, u.role, u.company || "", u.credits, u.active ? "Yes" : "No"]),
    ];
    const wsUsers = XLSX.utils.aoa_to_sheet(userData);
    wsUsers["!cols"] = [{ wch: 8 }, { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, wsUsers, "All Users");

    // Experts sheet
    const expertData = [
      ["Expert ID", "User ID", "Bio", "Expertise", "Credentials", "Rating", "Reviews", "Verified", "Tier", "Rate/min"],
      ...allExperts.map(e => [e.id, e.userId, (e.bio || "").substring(0, 100), e.expertise, e.credentials, (e.rating / 10).toFixed(1), e.totalReviews, e.verified ? "Yes" : "No", e.rateTier || "", e.ratePerMinute || ""]),
    ];
    const wsExperts = XLSX.utils.aoa_to_sheet(expertData);
    wsExperts["!cols"] = [{ wch: 10 }, { wch: 8 }, { wch: 40 }, { wch: 30 }, { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsExperts, "All Experts");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const today = new Date().toISOString().split('T')[0];

    await resend.emails.send({
      from: "A2A Global <noreply@a2a.global>",
      to: COFOUNDER_EMAILS,
      subject: `📊 A2A Global User Data Report — ${today} (${allUsers.length} users, ${allExperts.length} experts)`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
          <div style="text-align:center;padding:15px;border-bottom:2px solid #0F3DD1;">
            <img src="https://a2a.global/a2a-blue-logo.svg" alt="A2A Global" height="36" />
          </div>
          <h2 style="color:#0F3DD1;margin-top:20px;">Daily User Data Report</h2>
          <table style="width:100%;border-collapse:collapse;margin:15px 0;">
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Total Users</td><td style="padding:8px;border-bottom:1px solid #eee;">${allUsers.length}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Experts</td><td style="padding:8px;border-bottom:1px solid #eee;">${allExperts.length}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Clients</td><td style="padding:8px;border-bottom:1px solid #eee;">${allUsers.length - allExperts.length}</td></tr>
          </table>
          <p style="color:#666;font-size:13px;">Full Excel report attached with all user and expert data.</p>
        </div>
      `,
      attachments: [{
        filename: `A2A_User_Data_${today}.xlsx`,
        content: buffer.toString("base64"),
      }],
    });
    console.log(`[EMAIL] ✅ Full user data email sent (${allUsers.length} users)`);
  } catch (err) {
    console.error("[EMAIL] ❌ Full user data email failed:", err);
  }
}
