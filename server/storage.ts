import bcryptPkg from "bcrypt";
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
    photo TEXT
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
`);

// Auto-seed admin accounts on fresh database
const adminCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM admins").get() as { cnt: number };
if (adminCount.cnt === 0) {
  const hash = bcryptPkg.hashSync("A2A$uperAdmin2026!", 10);
  sqlite.prepare("INSERT INTO admins (email, password, name) VALUES (?, ?, ?)").run("amir@a2a.global", hash, "Amir (Admin)");
  sqlite.prepare("INSERT INTO admins (email, password, name) VALUES (?, ?, ?)").run("oleg@a2a.global", hash, "Oleg (Admin)");
  console.log("[DB] Admin accounts seeded.");
}
// Auto-seed demo accounts on fresh database
const userCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
if (userCount.cnt === 0) {
  const pwHash = bcryptPkg.hashSync("password123", 10);
  const now = new Date().toISOString();

  // demo_client — Alex Johnson
  sqlite.prepare(`INSERT INTO users (username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("demo_client", pwHash, "Alex Johnson", "alex@example.com", "client", 50, "TechCorp", "individual", 5000, 1, 0);
  const clientId = (sqlite.prepare("SELECT id FROM users WHERE username='demo_client'").get() as any).id;
  sqlite.prepare(`INSERT INTO credit_transactions (user_id, amount, type, description, created_at) VALUES (?, ?, ?, ?, ?)`).run(clientId, 5, "bonus", "Welcome bonus — $5 free credits", now);
  sqlite.prepare(`INSERT INTO credit_transactions (user_id, amount, type, description, created_at) VALUES (?, ?, ?, ?, ?)`).run(clientId, 45, "purchase", "Business package — 30 credits ($199)", now);

  // demo_expert — Dr. Sarah Chen (Pro tier, verified)
  sqlite.prepare(`INSERT INTO users (username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("demo_expert", pwHash, "Dr. Sarah Chen", "sarah@example.com", "expert", 25, "A2A Global", "individual", 15000, 1, 0);
  const expertUserId = (sqlite.prepare("SELECT id FROM users WHERE username='demo_expert'").get() as any).id;
  sqlite.prepare(`INSERT INTO experts (user_id, bio, expertise, credentials, rating, total_reviews, verified, categories, availability, hourly_rate, response_time, education, years_experience, onboarding_complete, verification_score, rate_per_minute, rate_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(expertUserId, "15+ years in financial advisory and wealth management. Former VP at Goldman Sachs.", "Investment Strategy, Tax Planning, Retirement Planning, Portfolio Management", "CFA, CFP, MBA Wharton", 48, 127, 1, JSON.stringify(["finance", "business"]), 1, 250, "< 12 hours", "MBA, Wharton School", 15, 3, 100, "2.50", "pro");

  // demo_expert2 — James Rivera (Pro tier, verified)
  sqlite.prepare(`INSERT INTO users (username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("demo_expert2", pwHash, "James Rivera", "james@example.com", "expert", 18, null, "individual", 8500, 1, 0);
  const expertUser2Id = (sqlite.prepare("SELECT id FROM users WHERE username='demo_expert2'").get() as any).id;
  sqlite.prepare(`INSERT INTO experts (user_id, bio, expertise, credentials, rating, total_reviews, verified, categories, availability, hourly_rate, response_time, education, years_experience, onboarding_complete, verification_score, rate_per_minute, rate_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(expertUser2Id, "Serial entrepreneur with 3 successful exits. Angel investor in 20+ startups.", "Startup Strategy, Fundraising, Product-Market Fit, Growth Hacking", "MBA Stanford, YC Alumni", 47, 89, 1, JSON.stringify(["entrepreneurship", "business"]), 1, 200, "< 24 hours", "MBA, Stanford Graduate School of Business", 10, 3, 90, "1.50", "pro");

  // demo_expert3 — Maria Lopez (Pro tier, verified)
  sqlite.prepare(`INSERT INTO users (username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("demo_expert3", pwHash, "Maria Lopez", "maria@example.com", "expert", 12, "FinTech Advisors", "individual", 22000, 1, 0);
  const expertUser3Id = (sqlite.prepare("SELECT id FROM users WHERE username='demo_expert3'").get() as any).id;
  sqlite.prepare(`INSERT INTO experts (user_id, bio, expertise, credentials, rating, total_reviews, verified, categories, availability, hourly_rate, response_time, education, years_experience, onboarding_complete, verification_score, rate_per_minute, rate_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(expertUser3Id, "Tax optimization specialist with 10+ years at Big 4. Expert in international tax structures.", "Tax Planning, International Tax, Corporate Finance, Compliance", "CPA, LLM Tax, CGMA", 46, 65, 1, JSON.stringify(["finance"]), 1, 180, "< 8 hours", "LLM in Taxation, NYU School of Law", 12, 3, 95, "3.00", "pro");

  // new_expert — Chris Taylor (unverified, needs onboarding)
  sqlite.prepare(`INSERT INTO users (username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("new_expert", pwHash, "Chris Taylor", "chris@example.com", "expert", 5, null, "individual", 0, 1, 0);
  const newExpertId = (sqlite.prepare("SELECT id FROM users WHERE username='new_expert'").get() as any).id;
  sqlite.prepare(`INSERT INTO experts (user_id, bio, expertise, credentials, rating, total_reviews, verified, categories, availability, hourly_rate, response_time, education, years_experience, onboarding_complete, verification_score, rate_per_minute, rate_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(newExpertId, "", "", "", 50, 0, 0, "[]", 0, null, null, "", 0, 0, null, null, null);

  // beta_user — Mike Thompson (client)
  sqlite.prepare(`INSERT INTO users (username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run("beta_user", pwHash, "Mike Thompson", "mike@startup.io", "client", 15, "StartupIO", "individual", 2500, 1, 0);

  console.log("[DB] Demo accounts seeded (demo_client, demo_expert, demo_expert2, demo_expert3, new_expert, beta_user).");
}

// Add photo column to users if it doesn't exist (migration for existing DBs)
try {
  sqlite.exec("ALTER TABLE users ADD COLUMN photo TEXT");
  console.log("[DB] Added photo column to users table.");
} catch (e: any) {
  // Column already exists — ignore
}
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
    clientPaid?: number;
    expertPayout?: number;
    platformFee?: number;
    takeRatePercent?: number;
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
  getInvoiceCount(): number;
  getUninvoicedReviewsByExpert(expertId: number): ExpertReview[];
  markReviewsInvoiced(reviewIds: number[]): void;
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
    return db.insert(users).values(user).returning().get();
  }
  updateUser(id: number, data: Partial<InsertUser>): User | undefined {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
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
    return db.insert(experts).values(expert).returning().get();
  }
  updateExpert(id: number, data: Partial<InsertExpert>): Expert | undefined {
    return db.update(experts).set(data).where(eq(experts.id, id)).returning().get();
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
    return db.insert(requests).values({
      ...request,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }
  updateRequest(id: number, data: Partial<InsertRequest>): ExpertRequest | undefined {
    return db.update(requests).set(data).where(eq(requests.id, id)).returning().get();
  }

  // Messages
  getMessagesByRequest(requestId: number): Message[] {
    return db.select().from(messages).where(eq(messages.requestId, requestId)).all();
  }
  createMessage(message: InsertMessage): Message {
    return db.insert(messages).values({
      ...message,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }

  // Credit transactions
  getTransactionsByUser(userId: number): CreditTransaction[] {
    return db.select().from(creditTransactions).where(eq(creditTransactions.userId, userId)).orderBy(desc(creditTransactions.id)).all();
  }
  getAllCreditTransactions(): CreditTransaction[] {
    return db.select().from(creditTransactions).orderBy(desc(creditTransactions.id)).all();
  }
  createTransaction(tx: InsertCreditTransaction): CreditTransaction {
    return db.insert(creditTransactions).values({
      ...tx,
      createdAt: new Date().toISOString(),
    }).returning().get();
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
    return db.insert(expertReviews).values({
      ...review,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }
  updateExpertReview(id: number, data: Partial<InsertExpertReview>): ExpertReview | undefined {
    return db.update(expertReviews).set(data).where(eq(expertReviews.id, id)).returning().get();
  }

  // Verification Tests
  createVerificationTest(test: InsertVerificationTest): VerificationTest {
    return db.insert(verificationTests).values({
      ...test,
      createdAt: new Date().toISOString(),
    }).returning().get();
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
    return db.insert(walletTransactions).values(tx).returning().get();
  }
  getWalletTransactionsByUser(userId: number): WalletTransaction[] {
    return db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.id)).all();
  }
  getAllWalletTransactions(): WalletTransaction[] {
    return db.select().from(walletTransactions).orderBy(desc(walletTransactions.id)).all();
  }

  // Notifications
  createNotification(n: InsertNotification): Notification {
    return db.insert(notifications).values(n).returning().get();
  }
  getNotificationsByUser(userId: number): Notification[] {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.id)).all();
  }
  markNotificationRead(id: number): Notification | undefined {
    return db.update(notifications).set({ read: 1 }).where(eq(notifications.id, id)).returning().get();
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
    return db.insert(admins).values(a).returning().get();
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

  // Request Events
  createRequestEvent(e: InsertRequestEvent): RequestEvent {
    return db.insert(requestEvents).values(e).returning().get();
  }
  getRequestEventsByRequest(requestId: number): RequestEvent[] {
    return db.select().from(requestEvents).where(eq(requestEvents.requestId, requestId)).all();
  }

  // Withdrawals
  createWithdrawal(w: InsertWithdrawal): Withdrawal {
    return db.insert(withdrawals).values(w).returning().get();
  }
  getAllWithdrawals(): Withdrawal[] {
    return db.select().from(withdrawals).orderBy(desc(withdrawals.id)).all();
  }
  getPendingWithdrawals(): Withdrawal[] {
    return db.select().from(withdrawals).where(eq(withdrawals.status, "pending")).orderBy(desc(withdrawals.id)).all();
  }
  updateWithdrawal(id: number, data: Partial<InsertWithdrawal>): Withdrawal | undefined {
    return db.update(withdrawals).set(data).where(eq(withdrawals.id, id)).returning().get();
  }

  // Invoices
  createInvoice(inv: InsertInvoice): Invoice {
    return db.insert(invoices).values(inv).returning().get();
  }
  getInvoicesByExpert(expertId: number): Invoice[] {
    return db.select().from(invoices).where(eq(invoices.expertId, expertId)).orderBy(desc(invoices.id)).all();
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
    db.update(expertReviews).set({ invoiced: 1 }).where(inArray(expertReviews.id, reviewIds)).run();
  }

  // FIX-4: All transactions with take rate details
  getAllTransactionsWithDetails(): Array<CreditTransaction & {
    userName: string;
    requestId?: number;
    requestTitle?: string;
    tier?: string;
    priceTier?: string | null;
    clientPaid?: number;
    expertPayout?: number;
    platformFee?: number;
    takeRatePercent?: number;
  }> {
    const TAKE_RATES: Record<string, number> = { standard: 0.50, pro: 0.30, guru: 0.15 };
    const allTx = db.select().from(creditTransactions).orderBy(desc(creditTransactions.id)).all();
    const allUsers = db.select().from(users).all();
    const allRequests = db.select().from(requests).all();
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    return allTx.map(t => {
      const base = { ...t, userName: userMap.get(t.userId)?.name || "Unknown" };
      let matchedRequest: typeof allRequests[0] | undefined;
      if (t.description) {
        for (const r of allRequests) {
          if (t.description.includes(r.title)) { matchedRequest = r; break; }
        }
      }
      if (!matchedRequest) return base;
      const tierKey = (matchedRequest.priceTier || matchedRequest.tier || "standard").toLowerCase();
      const takeRate = TAKE_RATES[tierKey] ?? 0.50;
      const takeRatePercent = Math.round(takeRate * 100);
      const clientPaid = matchedRequest.creditsCost;
      const expertPayout = Math.max(1, Math.floor(clientPaid * (1 - takeRate)));
      const platformFee = clientPaid - expertPayout;
      return {
        ...base,
        requestId: matchedRequest.id,
        requestTitle: matchedRequest.title,
        tier: matchedRequest.tier,
        priceTier: matchedRequest.priceTier,
        clientPaid,
        expertPayout,
        platformFee,
        takeRatePercent,
      };
    });
  }
}

export const storage = new DatabaseStorage();
