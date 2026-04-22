import bcryptPkg from "bcryptjs";
import {
  type User, type InsertUser, users,
  type Expert, type InsertExpert, experts,
  type Request as ExpertRequest, type InsertRequest, requests,
  type Message, type InsertMessage, messages,
  type CreditTransaction, type InsertCreditTransaction, creditTransactions,
  type ExpertReview, type InsertExpertReview, expertReviews,
  type VerificationTest, type InsertVerificationTest, verificationTests,
  type WalletTransaction, type InsertWalletTransaction, walletTransactions,
  type Notification, type InsertNotification, notifications,
  type Admin, type InsertAdmin, admins,
  type RequestEvent, type InsertRequestEvent, requestEvents,
  type Withdrawal, type InsertWithdrawal, withdrawals,
  type Invoice, type InsertInvoice, invoices,
  type ExpertVerification, type InsertExpertVerification, expertVerifications,
  type WithdrawalRequest, type InsertWithdrawalRequest, withdrawalRequests,
  type AuditLog, type InsertAuditLog, auditLog,
  type TakeRateHistory, type InsertTakeRateHistory, takeRateHistory,
  sessions,
} from "@shared/schema";
import { inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, and } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

// Auto-create tables if they don't exist (handles fresh deploys with no GCS backup)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE DEFAULT '',
    password TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'client',
    credits INTEGER NOT NULL DEFAULT 5,
    company TEXT,
    account_type TEXT NOT NULL DEFAULT 'individual',
    wallet_balance INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    tour_completed INTEGER NOT NULL DEFAULT 0,
    photo TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS experts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    bio TEXT NOT NULL DEFAULT '',
    expertise TEXT NOT NULL DEFAULT '',
    credentials TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL DEFAULT 50,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 0,
    categories TEXT NOT NULL DEFAULT '[]',
    availability INTEGER NOT NULL DEFAULT 1,
    hourly_rate INTEGER,
    response_time TEXT,
    education TEXT NOT NULL DEFAULT '',
    years_experience INTEGER NOT NULL DEFAULT 0,
    onboarding_complete INTEGER NOT NULL DEFAULT 0,
    verification_score INTEGER,
    rate_per_minute TEXT,
    rate_tier TEXT
  );
  CREATE TABLE IF NOT EXISTS verification_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expert_id INTEGER NOT NULL REFERENCES experts(id),
    category TEXT NOT NULL,
    answers TEXT NOT NULL DEFAULT '[]',
    score INTEGER NOT NULL DEFAULT 0,
    passed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT 'now'
  );
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expert_id INTEGER REFERENCES experts(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'standard',
    status TEXT NOT NULL DEFAULT 'pending',
    credits_cost INTEGER NOT NULL DEFAULT 1,
    expert_response TEXT,
    created_at TEXT NOT NULL DEFAULT 'now',
    deadline TEXT,
    service_type TEXT NOT NULL DEFAULT 'rate',
    ai_response TEXT,
    attachments TEXT NOT NULL DEFAULT '[]',
    experts_needed INTEGER NOT NULL DEFAULT 1,
    instructions TEXT,
    llm_provider TEXT,
    llm_model TEXT,
    price_per_minute TEXT,
    price_tier TEXT,
    service_category TEXT,
    client_rating INTEGER,
    client_rating_comment TEXT,
    refunded INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS admin_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_email TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS topup_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_email TEXT NOT NULL,
    user_name TEXT,
    amount_dollars REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    verified_by TEXT,
    verified_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS expert_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    expert_id INTEGER REFERENCES experts(id),
    status TEXT NOT NULL DEFAULT 'pending',
    rating INTEGER,
    rating_comment TEXT,
    correct_points TEXT,
    incorrect_points TEXT,
    suggestions TEXT,
    deliverable TEXT,
    created_at TEXT NOT NULL DEFAULT 'now',
    completed_at TEXT,
    invoiced INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT 'now'
  );
  CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT 'now'
  );
  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    type TEXT NOT NULL,
    stripe_payment_id TEXT,
    description TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    link TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS request_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    actor_id INTEGER,
    actor_name TEXT,
    message TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    expert_id INTEGER,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    processed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expert_id INTEGER NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    total_amount INTEGER NOT NULL,
    platform_fee INTEGER NOT NULL,
    net_payout INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    line_items TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS legal_acceptances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    document_version TEXT NOT NULL DEFAULT 'April 2026',
    accepted_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT
  );
  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address TEXT,
    session_id TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS registration_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    referrer TEXT,
    landing_page TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS file_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    data TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS expert_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expert_id INTEGER NOT NULL,
    passport_file_url TEXT,
    government_id_type TEXT,
    government_id_number TEXT,
    full_legal_name TEXT,
    country TEXT,
    full_address TEXT,
    account_number TEXT,
    swift_code TEXT,
    bank_name TEXT,
    bank_address TEXT,
    account_holder_name TEXT,
    bank_country TEXT,
    iban TEXT,
    routing_number TEXT,
    sort_code TEXT,
    ifsc_code TEXT,
    apartment_street TEXT,
    city TEXT,
    state_province TEXT,
    postal_code TEXT,
    verified_by_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expert_id INTEGER NOT NULL,
    amount TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    row_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS take_rate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tier TEXT NOT NULL,
    rate INTEGER NOT NULL,
    effective_from TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Build 45.6: RL insights cache (LLM-generated recommendations for admins)
  CREATE TABLE IF NOT EXISTS rl_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generated_at TEXT NOT NULL,
    source TEXT NOT NULL,              -- 'groq' | 'heuristic'
    signals_json TEXT NOT NULL,         -- snapshot of metrics used
    insights_json TEXT NOT NULL,        -- array of {title, rationale, impact, difficulty, suggestion}
    model_version TEXT
  );
`);

// FIX-5: Migration guard for file_attachments table on existing DBs
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS file_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    data TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`);
  console.log("[DB] file_attachments table ensured.");
} catch (e: any) {
  // Table already exists or other non-critical error
  console.log("[DB] file_attachments migration:", e.message);
}

// Build 39 Fix: Add uploader tracking columns to file_attachments
try { sqlite.exec("ALTER TABLE file_attachments ADD COLUMN uploader_id INTEGER"); } catch {}
try { sqlite.exec("ALTER TABLE file_attachments ADD COLUMN uploader_role TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE file_attachments ADD COLUMN gcs_path TEXT"); } catch {}
console.log("[DB] file_attachments uploader columns ensured.");

// Build 45 (AA bug #3): Feedback submissions from the in-app "Feedback F" button
// on Client and Expert dashboards. Rendered in the Admin Panel with Excel export.
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_number TEXT UNIQUE NOT NULL,
    user_id INTEGER,
    user_name TEXT,
    user_email TEXT,
    user_role TEXT,
    message TEXT NOT NULL,
    page_url TEXT,
    user_agent TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL
  )`);
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC)");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id)");
  console.log("[DB] feedback table ensured.");
} catch (e: any) {
  console.log("[DB] feedback migration:", e.message);
}

// Topup requests table — ensure it exists (may already be created by inline DDL)
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS topup_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_email TEXT NOT NULL DEFAULT '',
    user_name TEXT,
    amount_dollars REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    verified_by TEXT,
    verified_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  console.log("[DB] topup_requests table ensured.");
} catch (e: any) {
  console.log("[DB] topup_requests migration:", e.message);
}

// Fix mislogged admin actions: update action_type values for withdrawal actions that were logged
// with wrong types (e.g., "approve" instead of "approve_withdrawal" for withdrawal targets)
try {
  sqlite.exec(`UPDATE admin_actions SET action_type = 'approve_withdrawal' WHERE action_type = 'approve' AND target_type = 'withdrawal'`);
  sqlite.exec(`UPDATE admin_actions SET action_type = 'reject_withdrawal' WHERE action_type = 'reject' AND target_type = 'withdrawal'`);
  console.log("[DB] admin_actions withdrawal action types fixed.");
} catch (e: any) {
  console.log("[DB] admin_actions migration:", e.message);
}

// Auto-seed admin accounts on fresh database
const adminCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM admins").get() as { cnt: number };
if (adminCount.cnt === 0) {
  const hash = bcryptPkg.hashSync("A2A$uperAdmin2026!", 10);
  sqlite.prepare("INSERT INTO admins (email, password, name) VALUES (?, ?, ?)").run("amir@a2a.global", hash, "Amir (Admin)");
  sqlite.prepare("INSERT INTO admins (email, password, name) VALUES (?, ?, ?)").run("oleg@a2a.global", hash, "Oleg (Admin)");
  console.log("[DB] Admin accounts seeded.");
}
// Auto-seed demo accounts on fresh database — LOCAL DEV ONLY
// On staging/production, real data comes from GCS/Cloud SQL restore.
// Seeding on Cloud Run caused ID collisions: seed users claimed IDs 1-6 and
// credit_transactions IDs 1-2, then INSERT OR IGNORE silently dropped real
// production data at those same IDs. This also inflated wallet_balance for
// demo users (5000, 15000, 8500, 22000, 2500) which bled into staging Cloud SQL.
const nodeEnv = process.env.NODE_ENV || "development";
const userCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
if (userCount.cnt === 0 && nodeEnv === "development") {
  const pwHash = bcryptPkg.hashSync("password123", 10);
  const now = new Date().toISOString();

  // demo_client — Alex Johnson
  sqlite.prepare(`INSERT INTO users (username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("demo_client", pwHash, "Alex Johnson", "alex@example.com", "client", 50, "TechCorp", "individual", 0, 1, 0);
  const clientId = (sqlite.prepare("SELECT id FROM users WHERE username='demo_client'").get() as any).id;
  sqlite.prepare(`INSERT INTO credit_transactions (user_id, amount, type, description, created_at) VALUES (?, ?, ?, ?, ?)`).run(clientId, 5, "bonus", "Welcome bonus — $5 free credits", now);
  sqlite.prepare(`INSERT INTO credit_transactions (user_id, amount, type, description, created_at) VALUES (?, ?, ?, ?, ?)`).run(clientId, 45, "purchase", "Business package — 30 credits ($199)", now);

  // demo_expert — Dr. Sarah Chen (Pro tier, verified)
  sqlite.prepare(`INSERT INTO users (username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("demo_expert", pwHash, "Dr. Sarah Chen", "sarah@example.com", "expert", 25, "A2A Global", "individual", 0, 1, 0);
  const expertUserId = (sqlite.prepare("SELECT id FROM users WHERE username='demo_expert'").get() as any).id;
  sqlite.prepare(`INSERT INTO experts (user_id, bio, expertise, credentials, rating, total_reviews, verified, categories, availability, hourly_rate, response_time, education, years_experience, onboarding_complete, verification_score, rate_per_minute, rate_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(expertUserId, "15+ years in financial advisory and wealth management. Former VP at Goldman Sachs.", "Investment Strategy, Tax Planning, Retirement Planning, Portfolio Management", "CFA, CFP, MBA Wharton", 48, 127, 1, JSON.stringify(["finance", "business"]), 1, 250, "< 12 hours", "MBA, Wharton School", 15, 3, 100, "2.50", "pro");

  // demo_expert2 — James Rivera (Pro tier, verified)
  sqlite.prepare(`INSERT INTO users (username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("demo_expert2", pwHash, "James Rivera", "james@example.com", "expert", 18, null, "individual", 0, 1, 0);
  const expertUser2Id = (sqlite.prepare("SELECT id FROM users WHERE username='demo_expert2'").get() as any).id;
  sqlite.prepare(`INSERT INTO experts (user_id, bio, expertise, credentials, rating, total_reviews, verified, categories, availability, hourly_rate, response_time, education, years_experience, onboarding_complete, verification_score, rate_per_minute, rate_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(expertUser2Id, "Serial entrepreneur with 3 successful exits. Angel investor in 20+ startups.", "Startup Strategy, Fundraising, Product-Market Fit, Growth Hacking", "MBA Stanford, YC Alumni", 47, 89, 1, JSON.stringify(["entrepreneurship", "business"]), 1, 200, "< 24 hours", "MBA, Stanford Graduate School of Business", 10, 3, 90, "1.50", "pro");

  // demo_expert3 — Maria Lopez (Pro tier, verified)
  sqlite.prepare(`INSERT INTO users (username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("demo_expert3", pwHash, "Maria Lopez", "maria@example.com", "expert", 12, "FinTech Advisors", "individual", 0, 1, 0);
  const expertUser3Id = (sqlite.prepare("SELECT id FROM users WHERE username='demo_expert3'").get() as any).id;
  sqlite.prepare(`INSERT INTO experts (user_id, bio, expertise, credentials, rating, total_reviews, verified, categories, availability, hourly_rate, response_time, education, years_experience, onboarding_complete, verification_score, rate_per_minute, rate_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(expertUser3Id, "Tax optimization specialist with 10+ years at Big 4. Expert in international tax structures.", "Tax Planning, International Tax, Corporate Finance, Compliance", "CPA, LLM Tax, CGMA", 46, 65, 1, JSON.stringify(["finance"]), 1, 180, "< 8 hours", "LLM in Taxation, NYU School of Law", 12, 3, 95, "3.00", "pro");

  // new_expert — Chris Taylor (unverified, needs onboarding)
  sqlite.prepare(`INSERT INTO users (username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("new_expert", pwHash, "Chris Taylor", "chris@example.com", "expert", 5, null, "individual", 0, 1, 0);
  const newExpertId = (sqlite.prepare("SELECT id FROM users WHERE username='new_expert'").get() as any).id;
  sqlite.prepare(`INSERT INTO experts (user_id, bio, expertise, credentials, rating, total_reviews, verified, categories, availability, hourly_rate, response_time, education, years_experience, onboarding_complete, verification_score, rate_per_minute, rate_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(newExpertId, "", "", "", 50, 0, 0, "[]", 0, null, null, "", 0, 0, null, null, null);

  // beta_user — Mike Thompson (client)
  sqlite.prepare(`INSERT INTO users (username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("beta_user", pwHash, "Mike Thompson", "mike@startup.io", "client", 15, "StartupIO", "individual", 0, 1, 0);

  // Add demo requests for the available queue
  sqlite.prepare(`INSERT INTO requests (user_id, title, description, category, tier, status, credits_cost, created_at, service_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    clientId, "Review my investment portfolio allocation", "I have $100K split between stocks, bonds, and crypto. AI suggested 60/30/10 split. Is this appropriate for a 35-year-old?", "finance", "standard", "pending", 5, now, "review"
  );
  sqlite.prepare(`INSERT INTO requests (user_id, title, description, category, tier, status, credits_cost, created_at, service_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    clientId, "Startup valuation sanity check", "AI valued my SaaS startup at $4.2M based on 10x ARR. We have $420K ARR with 15% MoM growth. Is this realistic for Series A?", "entrepreneurship", "pro", "pending", 10, now, "review"
  );
  sqlite.prepare(`INSERT INTO requests (user_id, title, description, category, tier, status, credits_cost, created_at, service_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    clientId, "M&A deal structure review", "Reviewing acquisition terms for a healthcare staffing company. $15M enterprise value, 5.2x EBITDA. AI flagged the MAC clause as standard.", "finance", "guru", "pending", 15, now, "custom"
  );

  console.log("[DB] Demo accounts seeded (demo_client, demo_expert, demo_expert2, demo_expert3, new_expert, beta_user).");
} else if (userCount.cnt === 0) {
  console.log(`[DB] Skipping demo seed — NODE_ENV=${nodeEnv}. Real data will arrive from GCS/Cloud SQL restore.`);
}

// Add photo column to users if it doesn't exist (migration for existing DBs)
try {
  sqlite.exec("ALTER TABLE users ADD COLUMN photo TEXT");
  console.log("[DB] Added photo column to users table.");
} catch (e: any) {
  // Column already exists — ignore
}
// UTM tracking columns migration
try { sqlite.exec("ALTER TABLE users ADD COLUMN utm_source TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE users ADD COLUMN utm_medium TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE users ADD COLUMN utm_campaign TEXT"); } catch {}
// Follow-up tracking columns for requests (migration for existing DBs)
try { sqlite.exec("ALTER TABLE requests ADD COLUMN followup_count INTEGER NOT NULL DEFAULT 0"); } catch {}
try { sqlite.exec("ALTER TABLE requests ADD COLUMN followup_deadline TEXT"); } catch {}
// OB-B: Login count column
try { sqlite.exec("ALTER TABLE users ADD COLUMN login_count INTEGER NOT NULL DEFAULT 0"); } catch {}
// Build 35: Add created_at and updated_at timestamp columns to all tables
try { sqlite.exec("ALTER TABLE users ADD COLUMN created_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE users ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE admins ADD COLUMN created_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE admins ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE experts ADD COLUMN created_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE experts ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE sessions ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE verification_tests ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE requests ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE expert_reviews ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE messages ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE credit_transactions ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE wallet_transactions ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE notifications ADD COLUMN updated_at TEXT"); } catch {}
// Fix 5: Add type column to notifications for categorization
try { sqlite.exec("ALTER TABLE notifications ADD COLUMN type TEXT"); } catch {}
// Fix 4: Add completed_at column to requests
try { sqlite.exec("ALTER TABLE requests ADD COLUMN completed_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE request_events ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE withdrawals ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE invoices ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE page_views ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE registration_sources ADD COLUMN updated_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE legal_acceptances ADD COLUMN created_at TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE legal_acceptances ADD COLUMN updated_at TEXT"); } catch {}
// Data protection: take rate columns on credit_transactions
try { sqlite.exec("ALTER TABLE credit_transactions ADD COLUMN take_rate_percent INTEGER"); } catch {}
try { sqlite.exec("ALTER TABLE credit_transactions ADD COLUMN platform_fee INTEGER"); } catch {}
try { sqlite.exec("ALTER TABLE credit_transactions ADD COLUMN expert_payout INTEGER"); } catch {}
try { sqlite.exec("ALTER TABLE credit_transactions ADD COLUMN client_paid INTEGER"); } catch {}
// Build 40: Add expanded verification fields for OB's requirements
try { sqlite.exec("ALTER TABLE expert_verifications ADD COLUMN sort_code TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE expert_verifications ADD COLUMN ifsc_code TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE expert_verifications ADD COLUMN apartment_street TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE expert_verifications ADD COLUMN city TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE expert_verifications ADD COLUMN state_province TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE expert_verifications ADD COLUMN postal_code TEXT"); } catch {}
// Build 35: Backfill NULL timestamps on existing rows
try {
  const now = new Date().toISOString();
  sqlite.exec(`UPDATE users SET created_at = '${now}' WHERE created_at IS NULL`);
  sqlite.exec(`UPDATE users SET updated_at = '${now}' WHERE updated_at IS NULL`);
  sqlite.exec(`UPDATE admins SET created_at = '${now}' WHERE created_at IS NULL`);
  sqlite.exec(`UPDATE admins SET updated_at = '${now}' WHERE updated_at IS NULL`);
  sqlite.exec(`UPDATE experts SET created_at = '${now}' WHERE created_at IS NULL`);
  sqlite.exec(`UPDATE experts SET updated_at = '${now}' WHERE updated_at IS NULL`);
  sqlite.exec(`UPDATE legal_acceptances SET created_at = accepted_at WHERE created_at IS NULL`);
  sqlite.exec(`UPDATE legal_acceptances SET updated_at = accepted_at WHERE updated_at IS NULL`);
} catch {}
// Seed take_rate_history if empty
try {
  const trCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM take_rate_history").get() as { cnt: number };
  if (trCount.cnt === 0) {
    const now = new Date().toISOString();
    sqlite.prepare("INSERT INTO take_rate_history (tier, rate, effective_from, created_at) VALUES (?, ?, ?, ?)").run("standard", 50, "2026-01-01", now);
    sqlite.prepare("INSERT INTO take_rate_history (tier, rate, effective_from, created_at) VALUES (?, ?, ?, ?)").run("pro", 30, "2026-01-01", now);
    sqlite.prepare("INSERT INTO take_rate_history (tier, rate, effective_from, created_at) VALUES (?, ?, ?, ?)").run("guru", 15, "2026-01-01", now);
    console.log("[DB] Seeded take_rate_history with initial rates.");
  }
} catch {}
console.log("[DB] All tables ensured.");

export const db = drizzle(sqlite);
export { sqlite };

export interface IStorage {
  // Users
  getUser(id: number): User | undefined;
  getUserByUsername(username: string): User | undefined;
  getUserByEmail(email: string): User | undefined;
  getAllUsers(): User[];
  createUser(user: InsertUser): User;
  updateUser(id: number, data: Partial<InsertUser>): User | undefined;
  deleteUser(id: number): boolean; // Build 45.6.2 — hard-delete user from SQLite + MemStorage
  // Experts
  getExpert(id: number): Expert | undefined;
  getExpertByUserId(userId: number): Expert | undefined;
  getAllExperts(): Expert[];
  createExpert(expert: InsertExpert): Expert;
  updateExpert(id: number, data: Partial<InsertExpert>): Expert | undefined;
  // Requests
  getRequest(id: number): ExpertRequest | undefined;
  getRequestsByUser(userId: number): ExpertRequest[];
  getRequestsByExpert(expertId: number): ExpertRequest[];
  getAllRequests(): ExpertRequest[];
  getAllTransactions(): CreditTransaction[];
  getPendingRequests(): ExpertRequest[];
  createRequest(request: InsertRequest): ExpertRequest;
  updateRequest(id: number, data: Partial<InsertRequest>): ExpertRequest | undefined;
  // Messages
  getMessagesByRequest(requestId: number): Message[];
  createMessage(message: InsertMessage): Message;
  // Credit transactions
  getTransactionsByUser(userId: number): CreditTransaction[];
  getAllCreditTransactions(): CreditTransaction[];
  createTransaction(tx: InsertCreditTransaction): CreditTransaction;
  getAllTransactionsWithDetails(): Array<CreditTransaction & {
    userName: string;
    requestId?: number;
    requestTitle?: string;
    tier?: string;
    priceTier?: string | null;
  }>;
  // Expert Reviews
  getExpertReview(id: number): ExpertReview | undefined;
  getReviewsByRequest(requestId: number): ExpertReview[];
  getReviewsByExpert(expertId: number): ExpertReview[];
  getPendingReviews(): ExpertReview[];
  createExpertReview(review: InsertExpertReview): ExpertReview;
  updateExpertReview(id: number, data: Partial<InsertExpertReview>): ExpertReview | undefined;
  // Verification Tests
  createVerificationTest(test: InsertVerificationTest): VerificationTest;
  getVerificationTestsByExpert(expertId: number): VerificationTest[];
  // Expert profile with user data
  getExpertWithUser(expertId: number): (Expert & { userName: string }) | undefined;
  getExpertsByIds(ids: number[]): Array<Expert & { userName: string }>;
  getDetailedReviewsByRequest(requestId: number): Array<ExpertReview & { expert?: Expert & { userName: string } }>;
  // Wallet transactions
  createWalletTransaction(tx: InsertWalletTransaction): WalletTransaction;
  getWalletTransactionsByUser(userId: number): WalletTransaction[];
  getAllWalletTransactions(): WalletTransaction[];
  // Notifications
  createNotification(n: InsertNotification): Notification;
  getNotificationsByUser(userId: number): Notification[];
  markNotificationRead(id: number): Notification | undefined;
  getUnreadCount(userId: number): number;
  // Admins
  createAdmin(a: InsertAdmin): Admin;
  getAdminByEmail(email: string): Admin | undefined;
  getAllAdmins(): Admin[];
  // Sessions
  createSession(id: string, userId: number, expiresAt: string): void;
  getSession(id: string): { id: string; userId: number; expiresAt: string } | undefined;
  deleteSession(id: string): void;
  // Admin Actions
  createAdminAction(data: { adminEmail: string; actionType: string; targetType: string; targetId?: number; details?: string }): any;
  getAllAdminActions(): any[];
  // Request Events
  createRequestEvent(e: InsertRequestEvent): RequestEvent;
  getRequestEventsByRequest(requestId: number): RequestEvent[];
  // Withdrawals
  createWithdrawal(w: InsertWithdrawal): Withdrawal;
  getAllWithdrawals(): Withdrawal[];
  getPendingWithdrawals(): Withdrawal[];
  updateWithdrawal(id: number, data: Partial<InsertWithdrawal>): Withdrawal | undefined;
  // Invoices
  createInvoice(inv: InsertInvoice): Invoice;
  getInvoicesByExpert(expertId: number): Invoice[];
  getInvoiceByNumber(invoiceNumber: string): Invoice | undefined;
  getInvoiceCount(): number;
  getUninvoicedReviewsByExpert(expertId: number): ExpertReview[];
  markReviewsInvoiced(reviewIds: number[]): void;
  // Expert Verifications (OB-J)
  createExpertVerification(v: InsertExpertVerification): ExpertVerification;
  getExpertVerificationByExpert(expertId: number): ExpertVerification | undefined;
  updateExpertVerification(id: number, data: Partial<InsertExpertVerification>): ExpertVerification | undefined;
  getAllExpertVerifications(): ExpertVerification[];
  // Withdrawal Requests (OB-J)
  createWithdrawalRequest(w: InsertWithdrawalRequest): WithdrawalRequest;
  getWithdrawalRequestsByExpert(expertId: number): WithdrawalRequest[];
  getAllWithdrawalRequests(): WithdrawalRequest[];
  updateWithdrawalRequest(id: number, data: Partial<InsertWithdrawalRequest>): WithdrawalRequest | undefined;
  // Audit Log
  writeAuditLog(entry: { tableName: string; rowId: number; action: string; oldValue?: string; newValue?: string; reason?: string }): void;
  // Take Rate History
  getTakeRateHistory(): TakeRateHistory[];
  addTakeRateHistory(entry: InsertTakeRateHistory): TakeRateHistory;
}

export class DatabaseStorage implements IStorage {
  // Users
  getUser(id: number): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  getUserByUsername(username: string): User | undefined {
    return db.select().from(users).where(eq(users.username, username)).get();
  }
  getUserByEmail(email: string): User | undefined {
    return db.select().from(users).where(eq(users.email, email)).get();
  }
  getAllUsers(): User[] {
    return db.select().from(users).all();
  }
  createUser(user: InsertUser): User {
    const now = new Date().toISOString();
    return db.insert(users).values({ ...user, createdAt: now, updatedAt: now } as any).returning().get();
  }
  updateUser(id: number, data: Partial<InsertUser>): User | undefined {
    return db.update(users).set({ ...data, updatedAt: new Date().toISOString() } as any).where(eq(users.id, id)).returning().get();
  }
  // Build 45.6.2 — hard-delete user (admin only). Removes from SQLite. Caller must also
  // delete expert row, legal_acceptances, notifications, transactions, and Cloud SQL row.
  deleteUser(id: number): boolean {
    const result = db.delete(users).where(eq(users.id, id)).run();
    return (result.changes ?? 0) > 0;
  }

  // Experts
  getExpert(id: number): Expert | undefined {
    return db.select().from(experts).where(eq(experts.id, id)).get();
  }
  getExpertByUserId(userId: number): Expert | undefined {
    return db.select().from(experts).where(eq(experts.userId, userId)).get();
  }
  getAllExperts(): Expert[] {
    return db.select().from(experts).all();
  }
  createExpert(expert: InsertExpert): Expert {
    const now = new Date().toISOString();
    return db.insert(experts).values({ ...expert, createdAt: now, updatedAt: now } as any).returning().get();
  }
  updateExpert(id: number, data: Partial<InsertExpert>): Expert | undefined {
    return db.update(experts).set({ ...data, updatedAt: new Date().toISOString() } as any).where(eq(experts.id, id)).returning().get();
  }

  // Requests
  getRequest(id: number): ExpertRequest | undefined {
    return db.select().from(requests).where(eq(requests.id, id)).get();
  }
  getRequestsByUser(userId: number): ExpertRequest[] {
    return db.select().from(requests).where(eq(requests.userId, userId)).orderBy(desc(requests.id)).all();
  }
  getRequestsByExpert(expertId: number): ExpertRequest[] {
    return db.select().from(requests).where(eq(requests.expertId, expertId)).orderBy(desc(requests.id)).all();
  }
  getAllRequests(): ExpertRequest[] {
    return db.select().from(requests).orderBy(desc(requests.id)).all();
  }
  getAllTransactions(): CreditTransaction[] {
    return db.select().from(creditTransactions).all();
  }
  getPendingRequests(): ExpertRequest[] {
    return db.select().from(requests).where(eq(requests.status, "pending")).orderBy(desc(requests.id)).all();
  }
  createRequest(request: InsertRequest): ExpertRequest {
    const now = new Date().toISOString();
    return db.insert(requests).values({
      ...request,
      createdAt: now,
      updatedAt: now,
    } as any).returning().get();
  }
  updateRequest(id: number, data: Partial<InsertRequest>): ExpertRequest | undefined {
    return db.update(requests).set({ ...data, updatedAt: new Date().toISOString() } as any).where(eq(requests.id, id)).returning().get();
  }

  // Messages
  getMessagesByRequest(requestId: number): Message[] {
    return db.select().from(messages).where(eq(messages.requestId, requestId)).all();
  }
  createMessage(message: InsertMessage): Message {
    const now = new Date().toISOString();
    return db.insert(messages).values({
      ...message,
      createdAt: now,
      updatedAt: now,
    } as any).returning().get();
  }

  // Credit transactions
  getTransactionsByUser(userId: number): CreditTransaction[] {
    return db.select().from(creditTransactions).where(eq(creditTransactions.userId, userId)).orderBy(desc(creditTransactions.id)).all();
  }
  getAllCreditTransactions(): CreditTransaction[] {
    return db.select().from(creditTransactions).orderBy(desc(creditTransactions.id)).all();
  }
  createTransaction(tx: InsertCreditTransaction): CreditTransaction {
    const now = new Date().toISOString();
    return db.insert(creditTransactions).values({
      ...tx,
      createdAt: now,
      updatedAt: now,
    } as any).returning().get();
  }

  // Expert Reviews
  getExpertReview(id: number): ExpertReview | undefined {
    return db.select().from(expertReviews).where(eq(expertReviews.id, id)).get();
  }
  getReviewsByRequest(requestId: number): ExpertReview[] {
    return db.select().from(expertReviews).where(eq(expertReviews.requestId, requestId)).orderBy(desc(expertReviews.id)).all();
  }
  getReviewsByExpert(expertId: number): ExpertReview[] {
    return db.select().from(expertReviews).where(eq(expertReviews.expertId, expertId)).orderBy(desc(expertReviews.id)).all();
  }
  getPendingReviews(): ExpertReview[] {
    return db.select().from(expertReviews).where(eq(expertReviews.status, "pending")).orderBy(desc(expertReviews.id)).all();
  }
  createExpertReview(review: InsertExpertReview): ExpertReview {
    const now = new Date().toISOString();
    return db.insert(expertReviews).values({
      ...review,
      createdAt: now,
      updatedAt: now,
    } as any).returning().get();
  }
  updateExpertReview(id: number, data: Partial<InsertExpertReview>): ExpertReview | undefined {
    return db.update(expertReviews).set({ ...data, updatedAt: new Date().toISOString() } as any).where(eq(expertReviews.id, id)).returning().get();
  }

  // Verification Tests
  createVerificationTest(test: InsertVerificationTest): VerificationTest {
    const now = new Date().toISOString();
    return db.insert(verificationTests).values({
      ...test,
      createdAt: now,
      updatedAt: now,
    } as any).returning().get();
  }
  getVerificationTestsByExpert(expertId: number): VerificationTest[] {
    return db.select().from(verificationTests).where(eq(verificationTests.expertId, expertId)).orderBy(desc(verificationTests.id)).all();
  }

  // Expert profile with user data
  getExpertWithUser(expertId: number): (Expert & { userName: string }) | undefined {
    const row = db.select()
      .from(experts)
      .innerJoin(users, eq(experts.userId, users.id))
      .where(eq(experts.id, expertId))
      .get();
    if (!row) return undefined;
    return { ...row.experts, userName: row.users.name };
  }

  getExpertsByIds(ids: number[]): Array<Expert & { userName: string }> {
    if (ids.length === 0) return [];
    const rows = db.select()
      .from(experts)
      .innerJoin(users, eq(experts.userId, users.id))
      .where(inArray(experts.id, ids))
      .all();
    return rows.map((r) => ({ ...r.experts, userName: r.users.name }));
  }

  getDetailedReviewsByRequest(requestId: number): Array<ExpertReview & { expert?: Expert & { userName: string } }> {
    const reviews = db.select().from(expertReviews).where(eq(expertReviews.requestId, requestId)).orderBy(desc(expertReviews.id)).all();
    const expertIds = Array.from(new Set(reviews.filter((r) => r.expertId != null).map((r) => r.expertId!)));
    const expertsMap = new Map<number, Expert & { userName: string }>();
    if (expertIds.length > 0) {
      const expertsData = this.getExpertsByIds(expertIds);
      expertsData.forEach((e) => expertsMap.set(e.id, e));
    }
    return reviews.map((rev) => ({
      ...rev,
      expert: rev.expertId ? expertsMap.get(rev.expertId) : undefined,
    }));
  }

  // Wallet transactions
  createWalletTransaction(tx: InsertWalletTransaction): WalletTransaction {
    const now = new Date().toISOString();
    return db.insert(walletTransactions).values({ ...tx, updatedAt: now } as any).returning().get();
  }
  getWalletTransactionsByUser(userId: number): WalletTransaction[] {
    return db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.id)).all();
  }
  getAllWalletTransactions(): WalletTransaction[] {
    return db.select().from(walletTransactions).orderBy(desc(walletTransactions.id)).all();
  }

  // Notifications
  createNotification(n: InsertNotification): Notification {
    const now = new Date().toISOString();
    return db.insert(notifications).values({ ...n, updatedAt: now } as any).returning().get();
  }
  getNotificationsByUser(userId: number): Notification[] {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.id)).all();
  }
  markNotificationRead(id: number): Notification | undefined {
    return db.update(notifications).set({ read: 1, updatedAt: new Date().toISOString() }).where(eq(notifications.id, id)).returning().get();
  }
  getUnreadCount(userId: number): number {
    const result = db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, 0)))
      .get();
    return result?.count ?? 0;
  }

  // Admins
  createAdmin(a: InsertAdmin): Admin {
    const now = new Date().toISOString();
    return db.insert(admins).values({ ...a, createdAt: now, updatedAt: now } as any).returning().get();
  }
  getAdminByEmail(email: string): Admin | undefined {
    return db.select().from(admins).where(eq(admins.email, email)).get();
  }
  getAllAdmins(): Admin[] {
    return db.select().from(admins).all();
  }

  // Sessions
  createSession(id: string, userId: number, expiresAt: string): void {
    db.insert(sessions).values({ id, userId, expiresAt, createdAt: new Date().toISOString() }).run();
  }
  getSession(id: string): { id: string; userId: number; expiresAt: string } | undefined {
    return db.select().from(sessions).where(eq(sessions.id, id)).get() as any;
  }
  deleteSession(id: string): void {
    db.delete(sessions).where(eq(sessions.id, id)).run();
  }

  // Admin Actions (action journal)
  createAdminAction(data: { adminEmail: string; actionType: string; targetType: string; targetId?: number; details?: string }): any {
    const stmt = sqlite.prepare("INSERT INTO admin_actions (admin_email, action_type, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)");
    const now = new Date().toISOString();
    const result = stmt.run(data.adminEmail, data.actionType, data.targetType, data.targetId || null, data.details || null, now);
    const id = Number(result.lastInsertRowid);
    return { id, ...data, createdAt: now };
  }
  getAllAdminActions(): any[] {
    return sqlite.prepare("SELECT * FROM admin_actions ORDER BY created_at DESC").all();
  }

  // Topup Requests
  createTopupRequest(data: { userId: number; userEmail: string; userName: string; amountDollars: number }): any {
    const now = new Date().toISOString();
    const result = sqlite.prepare("INSERT INTO topup_requests (user_id, user_email, user_name, amount_dollars, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)").run(data.userId, data.userEmail, data.userName, data.amountDollars, now, now);
    return { id: Number(result.lastInsertRowid), userId: data.userId, userEmail: data.userEmail, userName: data.userName, amountDollars: data.amountDollars, status: "pending", createdAt: now };
  }
  getAllTopupRequests(): any[] {
    return sqlite.prepare("SELECT * FROM topup_requests ORDER BY created_at DESC").all();
  }
  getTopupRequest(id: number): any {
    return sqlite.prepare("SELECT * FROM topup_requests WHERE id = ?").get(id);
  }
  updateTopupRequest(id: number, updates: Record<string, any>): any {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(", ");
    const values = Object.values(updates);
    sqlite.prepare(`UPDATE topup_requests SET ${fields}, updated_at = ? WHERE id = ?`).run(...values, new Date().toISOString(), id);
    return sqlite.prepare("SELECT * FROM topup_requests WHERE id = ?").get(id);
  }

  // Request Events
  createRequestEvent(e: InsertRequestEvent): RequestEvent {
    const now = new Date().toISOString();
    return db.insert(requestEvents).values({ ...e, updatedAt: now } as any).returning().get();
  }
  getRequestEventsByRequest(requestId: number): RequestEvent[] {
    return db.select().from(requestEvents).where(eq(requestEvents.requestId, requestId)).all();
  }

  // Withdrawals
  createWithdrawal(w: InsertWithdrawal): Withdrawal {
    const now = new Date().toISOString();
    return db.insert(withdrawals).values({ ...w, updatedAt: now } as any).returning().get();
  }
  getAllWithdrawals(): Withdrawal[] {
    return db.select().from(withdrawals).orderBy(desc(withdrawals.id)).all();
  }
  getPendingWithdrawals(): Withdrawal[] {
    return db.select().from(withdrawals).where(eq(withdrawals.status, "pending")).orderBy(desc(withdrawals.id)).all();
  }
  updateWithdrawal(id: number, data: Partial<InsertWithdrawal>): Withdrawal | undefined {
    return db.update(withdrawals).set({ ...data, updatedAt: new Date().toISOString() } as any).where(eq(withdrawals.id, id)).returning().get();
  }

  // Invoices
  createInvoice(inv: InsertInvoice): Invoice {
    const now = new Date().toISOString();
    return db.insert(invoices).values({ ...inv, updatedAt: now } as any).returning().get();
  }
  getInvoicesByExpert(expertId: number): Invoice[] {
    return db.select().from(invoices).where(eq(invoices.expertId, expertId)).orderBy(desc(invoices.id)).all();
  }
  getInvoiceByNumber(invoiceNumber: string): Invoice | undefined {
    return db.select().from(invoices).where(eq(invoices.invoiceNumber, invoiceNumber)).get();
  }
  getInvoiceCount(): number {
    const result = db.select({ count: sql<number>`count(*)` }).from(invoices).get();
    return result?.count ?? 0;
  }
  getUninvoicedReviewsByExpert(expertId: number): ExpertReview[] {
    return db.select().from(expertReviews)
      .where(and(eq(expertReviews.expertId, expertId), eq(expertReviews.status, "completed"), eq(expertReviews.invoiced, 0)))
      .orderBy(desc(expertReviews.id))
      .all();
  }
  markReviewsInvoiced(reviewIds: number[]): void {
    if (reviewIds.length === 0) return;
    db.update(expertReviews).set({ invoiced: 1, updatedAt: new Date().toISOString() }).where(inArray(expertReviews.id, reviewIds)).run();
  }

  // FIX-4: All transactions with take rate details (prefer stored fields, fallback to computed)
  getAllTransactionsWithDetails(): Array<CreditTransaction & {
    userName: string;
    requestId?: number;
    requestTitle?: string;
    tier?: string;
    priceTier?: string | null;
  }> {
    const TAKE_RATES: Record<string, number> = { standard: 0.50, pro: 0.30, guru: 0.15 };
    const allTx = db.select().from(creditTransactions).orderBy(desc(creditTransactions.id)).all();
    const allUsers = db.select().from(users).all();
    const allRequests = db.select().from(requests).all();
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    return allTx.map(t => {
      const base: any = { ...t, userName: userMap.get(t.userId)?.name || "Unknown" };

      // Use stored take rate fields if available (post-migration transactions)
      if (t.takeRatePercent != null) {
        let matchedRequest: typeof allRequests[0] | undefined;
        if (t.description) {
          for (const r of allRequests) {
            if (t.description.includes(r.title)) { matchedRequest = r; break; }
          }
        }
        base.requestId = matchedRequest?.id;
        base.requestTitle = matchedRequest?.title;
        base.tier = matchedRequest?.tier;
        base.priceTier = matchedRequest?.priceTier;
        return base;
      }

      // Fallback: compute from request data (pre-migration transactions)
      let matchedRequest: typeof allRequests[0] | undefined;
      if (t.description) {
        for (const r of allRequests) {
          if (t.description.includes(r.title)) { matchedRequest = r; break; }
        }
      }
      if (!matchedRequest) return base;
      const tierKey = (matchedRequest.priceTier || matchedRequest.tier || "standard").toLowerCase();
      const takeRate = TAKE_RATES[tierKey] ?? 0.50;
      base.requestId = matchedRequest.id;
      base.requestTitle = matchedRequest.title;
      base.tier = matchedRequest.tier;
      base.priceTier = matchedRequest.priceTier;
      base.clientPaid = matchedRequest.creditsCost;
      base.expertPayout = Math.max(1, Math.floor(matchedRequest.creditsCost * (1 - takeRate)));
      base.platformFee = matchedRequest.creditsCost - base.expertPayout;
      base.takeRatePercent = Math.round(takeRate * 100);
      return base;
    });
  }

  // Expert Verifications (OB-J)
  createExpertVerification(v: InsertExpertVerification): ExpertVerification {
    const now = new Date().toISOString();
    return db.insert(expertVerifications).values({ ...v, updatedAt: now } as any).returning().get();
  }
  getExpertVerificationByExpert(expertId: number): ExpertVerification | undefined {
    return db.select().from(expertVerifications).where(eq(expertVerifications.expertId, expertId)).get();
  }
  updateExpertVerification(id: number, data: Partial<InsertExpertVerification>): ExpertVerification | undefined {
    return db.update(expertVerifications).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(expertVerifications.id, id)).returning().get();
  }
  getAllExpertVerifications(): ExpertVerification[] {
    return db.select().from(expertVerifications).orderBy(desc(expertVerifications.id)).all();
  }

  // Withdrawal Requests (OB-J)
  createWithdrawalRequest(w: InsertWithdrawalRequest): WithdrawalRequest {
    const now = new Date().toISOString();
    return db.insert(withdrawalRequests).values({ ...w, updatedAt: now } as any).returning().get();
  }
  getWithdrawalRequestsByExpert(expertId: number): WithdrawalRequest[] {
    return db.select().from(withdrawalRequests).where(eq(withdrawalRequests.expertId, expertId)).orderBy(desc(withdrawalRequests.id)).all();
  }
  getAllWithdrawalRequests(): WithdrawalRequest[] {
    return db.select().from(withdrawalRequests).orderBy(desc(withdrawalRequests.id)).all();
  }
  updateWithdrawalRequest(id: number, data: Partial<InsertWithdrawalRequest>): WithdrawalRequest | undefined {
    return db.update(withdrawalRequests).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(withdrawalRequests.id, id)).returning().get();
  }

  // Audit Log
  writeAuditLog(entry: { tableName: string; rowId: number; action: string; oldValue?: string; newValue?: string; reason?: string }): void {
    db.insert(auditLog).values({
      tableName: entry.tableName,
      rowId: entry.rowId,
      action: entry.action,
      oldValue: entry.oldValue || null,
      newValue: entry.newValue || null,
      reason: entry.reason || null,
      createdAt: new Date().toISOString(),
    }).run();
  }

  // Take Rate History
  getTakeRateHistory(): TakeRateHistory[] {
    return db.select().from(takeRateHistory).orderBy(desc(takeRateHistory.id)).all();
  }
  addTakeRateHistory(entry: InsertTakeRateHistory): TakeRateHistory {
    return db.insert(takeRateHistory).values(entry).returning().get();
  }
}

export const storage = new DatabaseStorage();
