import type { Express, Request as ExpressRequest, Response as ExpressResponse, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, sqlite } from "./storage";
import { otpRegisterSchema, otpVerifySchema, otpLoginSchema } from "@shared/schema";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import rateLimit from "express-rate-limit";
import type { Response } from "express";
import { sendOtpEmail, sendInvoiceEmail, sendVerificationEmail } from "./email";
import multer from "multer";
import jwt from "jsonwebtoken";
import { triggerBackup } from "./db-persistence";
import { writeUserToBigQuery, sendUserRegistrationEmail, sendFullUserDataEmail, writeUserToCloudSql, writeRequestToCloudSql, writeExpertToCloudSql, writeCreditTransactionToCloudSql, writeExpertReviewToCloudSql, writeMessageToCloudSql, writeNotificationToCloudSql, writeRequestEventToCloudSql, writeWalletTransactionToCloudSql, writeWithdrawalToCloudSql, writeInvoiceToCloudSql, writeVerificationTestToCloudSql, writeExpertVerificationToCloudSql, writeWithdrawalRequestToCloudSql, writeFileAttachmentToCloudSql, writeExpertPassportToCloudSql } from "./user-data-persist";

// Bug-2 fix: Track server start time for health check grace period
const SERVER_START_TIME = Date.now();

// ─── JWT Admin Auth ───
const JWT_SECRET = process.env.JWT_SECRET || "a2a-admin-jwt-secret-2026-build31";

function signAdminToken(admin: { id: number; email: string; name: string }): string {
  return jwt.sign({ id: admin.id, email: admin.email, name: admin.name, role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
}

function adminAuth(req: ExpressRequest, res: ExpressResponse, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: true, message: "Admin authentication required", code: "ADMIN_AUTH_REQUIRED" });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: true, message: "Admin access required", code: "ADMIN_FORBIDDEN" });
    }
    (req as any).admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: true, message: "Invalid or expired admin token", code: "ADMIN_TOKEN_INVALID" });
  }
}

function userOrAdminAuth(req: ExpressRequest, res: ExpressResponse, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: true, message: "Authentication required", code: "AUTH_REQUIRED" });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
    (req as any).authUser = decoded;
    next();
  } catch {
    return res.status(401).json({ error: true, message: "Invalid or expired token", code: "TOKEN_INVALID" });
  }
}

// Auth helper: verify the authenticated user owns the resource (or is admin)
function ownerOrAdmin(req: ExpressRequest, res: ExpressResponse, paramOrBodyField: string, source: 'params' | 'body' = 'params'): boolean {
  const authUser = (req as any).authUser;
  if (!authUser) { res.status(401).json({ error: true, message: "Authentication required" }); return false; }
  const targetId = source === 'params' ? parseInt(req.params[paramOrBodyField]) : parseInt(req.body?.[paramOrBodyField]);
  if (authUser.role === 'admin') return true;
  if (authUser.id !== targetId) {
    res.status(403).json({ error: true, message: "You can only perform this action on your own account", code: "FORBIDDEN" });
    return false;
  }
  return true;
}

// Multer config: memory storage, 5MB limit, images only
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

// Multer config: memory storage, 50MB limit, all file types
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ─── GCS helpers for attachments ───
async function getGcpToken(): Promise<string | null> {
  try {
    const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const json = await res.json() as { access_token: string };
    return json.access_token;
  } catch {
    return null;
  }
}

const GCS_BUCKET = process.env.GCS_BUCKET || "a2a-global-data";
const GCS_PREFIX = process.env.GCS_PREFIX || "";

async function uploadToGcs(path: string, data: Buffer, contentType: string): Promise<void> {
  const token = await getGcpToken();
  if (!token) throw new Error("No GCS token available");
  const fullPath = `${GCS_PREFIX}${path}`;
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${GCS_BUCKET}/o?uploadType=media&name=${encodeURIComponent(fullPath)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body: data,
  });
  if (!resp.ok) throw new Error(`GCS upload failed: ${resp.status} ${await resp.text()}`);
}

async function downloadFromGcs(path: string): Promise<Response> {
  const token = await getGcpToken();
  if (!token) throw new Error("No GCS token available");
  const fullPath = `${GCS_PREFIX}${path}`;
  const url = `https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET}/o/${encodeURIComponent(fullPath)}?alt=media`;
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }) as unknown as Response;
}

// ─── SSE connections store ───
const activeConnections = new Map<number, Set<(data: any) => void>>();

function normalizeTier(raw: string | null | undefined): string {
  if (!raw) return "Standard";
  const t = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (t === "guru" || t === "ultimate") return "Guru";
  if (t === "pro" || t === "advanced" || t === "specialist") return "Pro";
  return "Standard";
}

// FIX-11: Safe array coercion — prevents '(t || []).filter is not a function' errors in admin UI
const safeArray = (v: any): any[] => Array.isArray(v) ? v : [];

function notifyUser(userId: number, event: { type: string; title: string; message: string; requestId?: number }) {
  const senders = activeConnections.get(userId);
  if (senders) {
    senders.forEach((send) => send(event));
  }
}

function logRequestEvent(requestId: number, type: string, actorId?: number, actorName?: string, message?: string) {
  const evt = storage.createRequestEvent({
    requestId,
    type,
    actorId: actorId ?? null,
    actorName: actorName ?? null,
    message: message ?? null,
    createdAt: new Date().toISOString(),
  });
  writeRequestEventToCloudSql(evt).catch(() => {});
}

// G2-1: Sync wrapper — persists notification to Cloud SQL after local insert
// ─── Fix 1: XSS sanitization helper ───
function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function sanitizeObject(obj: Record<string, any>, fields: string[]): Record<string, any> {
  const result = { ...obj };
  for (const field of fields) {
    if (typeof result[field] === 'string') {
      result[field] = sanitizeHtml(result[field]);
    }
  }
  return result;
}

function createAndSyncNotification(data: { userId: number; title: string; message: string; type?: string; read: number; link?: string; createdAt: string }) {
  const notif = storage.createNotification(data);
  writeNotificationToCloudSql(notif).catch(() => {});
  return notif;
}

// G2-1: Sync wrapper — persists message to Cloud SQL after local insert
function createAndSyncMessage(data: { requestId: number; role: string; content: string }) {
  const msg = storage.createMessage(data);
  writeMessageToCloudSql(msg).catch(() => {});
  return msg;
}

// Groq primary (free, commercial use), Anthropic fallback (sandbox)
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
let groq: any = null;
if (GROQ_API_KEY) {
  try { groq = new Groq({ apiKey: GROQ_API_KEY }); } catch { groq = null; }
}
let anthropic: Anthropic | null = null;
try { anthropic = new Anthropic(); } catch { anthropic = null; }

const CREDIT_PACKS: Record<string, { dollars: number; credits: number; name: string }> = {
  pack10: { dollars: 10, credits: 10, name: "$10 — 10 Credits" },
  pack25: { dollars: 25, credits: 28, name: "$25 — 28 Credits (12% bonus)" },
  pack50: { dollars: 50, credits: 60, name: "$50 — 60 Credits (20% bonus)" },
  pack100: { dollars: 100, credits: 130, name: "$100 — 130 Credits (30% bonus)" },
};

// Take rates by pricing tier (platform keeps this %)
const TAKE_RATES: Record<string, number> = {
  standard: 0.50,
  pro: 0.30,
  guru: 0.15,
};

const TEST_ASSIGNMENTS = [
  // ─── FINANCE ───
  {
    id: "finance_1",
    category: "finance",
    title: "Mortgage Refinancing Analysis",
    userQuestion: "I have a 30-year mortgage at 7.2% with $340,000 remaining balance and 22 years left. My bank is offering a refinance to a 20-year fixed at 6.1%. Should I refinance?",
    aiAnswer: `Great question! Let's break down the numbers to see if refinancing makes sense for you.

**Current mortgage:** $340,000 at 7.2%, 22 years remaining
Monthly payment: approximately $2,470/month
Total remaining payments: $651,240
Total interest remaining: $311,240

**New mortgage (refinanced):** $340,000 at 6.1%, 20-year fixed
Monthly payment: approximately $2,448/month
Total payments: $587,520
Total interest: $247,520

**Monthly savings:** $22/month
**Interest savings over life of loan:** $63,720

**Break-even analysis:** Typical refinancing closing costs are around $6,800 (2% of loan balance). At $22/month savings, your break-even point is 309 months — or about 25.7 years. Since you're only keeping a 20-year loan, you would NOT break even on this refinance.

**Recommendation:** This refinance does not make financial sense given the small monthly savings and high break-even period. Do not refinance.`,
  },
  {
    id: "finance_2",
    category: "finance",
    title: "Retirement Planning Recommendation",
    userQuestion: "I'm 35 years old, earning $95,000/year, and I currently have $42,000 saved in a 401(k). I contribute 6% of my salary and my employer matches 3%. How much will I have at retirement at age 65?",
    aiAnswer: `Let's project your retirement savings to age 65 (30-year horizon).

**Current situation:**
- Salary: $95,000/year
- Your contribution: 6% = $5,700/year
- Employer match: 3% = $2,850/year
- Total annual contribution: $8,550/year
- Current balance: $42,000

**Projection:**
Using a 7% annual return (long-term S&P 500 average), your $42,000 today will grow to:

$42,000 × (1.07)^30 = **$319,883**

Your annual contributions of $8,550 invested over 30 years at 7%:

$8,550 × [(1.07^30 - 1) / 0.07] = $8,550 × 94.46 = **$807,633**

**Total projected retirement savings: $1,127,516**

At a 4% withdrawal rate, this gives you **$45,100/year** in retirement income.

**Recommendation:** You are on a reasonable track but may want to increase contributions to 10% of salary to build a more comfortable buffer.`,
  },
  // ─── BUSINESS ───
  {
    id: "business_1",
    category: "business",
    title: "SaaS LATAM Market Entry",
    userQuestion: "We're a B2B SaaS company with $2M ARR doing HR software. We want to expand to Latin America, starting with Brazil. What's our market entry strategy?",
    aiAnswer: `Great timing — Latin America's SaaS market is booming. Here's a market entry strategy for Brazil.

**Market opportunity:**
- Brazil's SaaS market is valued at approximately $2.1 billion (2023) and growing at ~18% CAGR
- HR software specifically addresses a market of ~$340 million in Brazil

**Recommended strategy: Direct + Partnership entry**

**Phase 1 (Months 1–6):** Localize product to Portuguese, hire 2 local sales reps in São Paulo, price in BRL.

**Phase 2 (Months 7–12):** Partner with local payroll software companies for distribution. Attend HR Tech Brasil.

**Phase 3 (Months 13–24):** Open São Paulo office. Expand to Mexico and Colombia.

**Revenue projection:** Year 1 revenue from Brazil = $340,000.`,
  },
  {
    id: "business_2",
    category: "business",
    title: "Competitive Analysis",
    userQuestion: "Do a competitive analysis of the project management software space for a startup building a new tool targeting remote-first tech teams.",
    aiAnswer: `**Competitive landscape: Project Management Software (Remote-First Focus)**

**Tier 1 — Dominant players:** Asana, Monday.com, Jira (Atlassian)
**Tier 2 — Strong challengers:** Notion, ClickUp, Linear

**Positioning opportunity:**
Remote-first tech teams are underserved by tools designed for in-office workflows. A differentiated product could focus on async communication integration, time zone management, and clear ownership visibility.

**Recommendation:** Enter as an "async-first for remote engineering teams" tool. Target 10–100 person tech companies. Price at $10–15/user/month.`,
  },
  // ─── ENTREPRENEURSHIP ───
  {
    id: "entrepreneurship_1",
    category: "entrepreneurship",
    title: "Pitch Deck Review",
    userQuestion: "Review my startup's pitch deck. We're a marketplace connecting dog owners with dog trainers. TAM is the US pet industry ($150B), SAM is pet services ($11B), SOM is dog training specifically ($2.1B). We've done $18K in GMV in 3 months with 14 trainers and 52 customers. Is our pitch deck investor-ready?",
    aiAnswer: `Your pitch deck is shaping up well. Market sizing looks strong with well-constructed TAM/SAM/SOM funnel.

**Traction — Promising:** $18K GMV in 3 months with 14 trainers and 52 customers. Month 3 run rate: $72K annualized GMV.

**Unit Economics:** At 20% take rate, annualized revenue is $14,400.

**Recommendation:** The pitch deck is investor-ready for pre-seed conversations. Strengthen the deck by adding customer retention data and trainer satisfaction scores.`,
  },
  {
    id: "entrepreneurship_2",
    category: "entrepreneurship",
    title: "Go-to-Market Plan",
    userQuestion: "I'm launching a B2B SaaS tool for restaurant operators to track food waste. $99/month, targeting 1,000 customers in year 1.",
    aiAnswer: `Here's your go-to-market strategy for targeting independent US restaurants with your food waste tracking tool.

**Primary channels:** Content marketing / SEO, restaurant industry conferences, social media, cold email to restaurant owners.

**Year 1 targets:** 1,000 customers × $99/month = $1.188M ARR.

**Recommendation:** Lead with content marketing and cold email. Plan for 18 months to reach 1,000 customers organically.`,
  },
] as const;

function getSystemPrompt(category: string) {
  const categoryMap: Record<string, string> = {
    finance: "You are an expert financial advisor with deep knowledge of personal finance, investments, markets, tax planning, and wealth management. Provide thoughtful, detailed analysis. Always include a disclaimer that this is AI-generated and should be verified by a human expert.",
    business: "You are an expert business strategist with deep knowledge of business operations, management, marketing, growth strategy, and organizational development. Provide actionable insights. Always include a disclaimer that this is AI-generated and should be verified by a human expert.",
    entrepreneurship: "You are an expert startup advisor with deep knowledge of entrepreneurship, fundraising, product-market fit, scaling, and startup operations. Provide practical, founder-friendly advice. Always include a disclaimer that this is AI-generated and should be verified by a human expert.",
  };
  return categoryMap[category] || categoryMap.finance;
}

async function getAIResponse(messages: Array<{ role: string; content: string }>, category: string, maxTokens = 1024): Promise<string> {
  // 1. Try Groq first if available (free, commercial use)
  if (groq) {
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: maxTokens,
        messages: [
          { role: "system" as const, content: getSystemPrompt(category) },
          ...messages.map((m) => ({
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.content,
          })),
        ],
      });
      return response.choices[0]?.message?.content || "";
    } catch (groqError: any) {
      console.error("Groq API error (trying Anthropic fallback):", groqError.message);
    }
  }

  // 2. Fall back to Anthropic if available
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: maxTokens,
        system: getSystemPrompt(category),
        messages: messages.map((m) => ({
          role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: m.content,
        })),
      });
      return response.content[0]?.type === "text" ? response.content[0].text : "";
    } catch (anthropicError: any) {
      console.error("Anthropic fallback error:", anthropicError.message);
    }
  }

  // 3. No AI provider available
  if (!groq) {
    return "Please configure GROQ_API_KEY environment variable to enable AI responses.";
  }
  return "AI service temporarily unavailable. Please try again in a moment.";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ─── Cloud SQL sync helper — fire-and-forget after SQLite mutations ───
  function syncUserToCloud(userId: number) {
    const u = storage.getUser(userId);
    if (!u) return;
    writeUserToCloudSql({
      id: u.id, name: u.name, email: u.email, role: u.role,
      company: u.company, credits: u.credits,
      walletBalance: u.walletBalance ?? 0, active: u.active ?? 1,
      loginCount: (u as any).loginCount ?? 0, tourCompleted: (u as any).tourCompleted ?? 0,
      utmSource: (u as any).utmSource || null, utmMedium: (u as any).utmMedium || null,
      utmCampaign: (u as any).utmCampaign || null,
    }).catch(() => {});
  }
  function syncRequestToCloud(requestId: number) {
    const r = storage.getRequest(requestId);
    if (!r) return;
    writeRequestToCloudSql({
      id: r.id, userId: r.userId, expertId: r.expertId, title: r.title,
      description: r.description, category: r.category, tier: r.tier,
      status: r.status, creditsCost: r.creditsCost, serviceType: r.serviceType,
    }).catch(() => {});
  }
  function syncExpertToCloud(expertId: number) {
    const e = storage.getExpert(expertId);
    if (!e) return;
    writeExpertToCloudSql({
      id: e.id, userId: e.userId, bio: e.bio, expertise: e.expertise,
      credentials: e.credentials, rating: e.rating, totalReviews: e.totalReviews,
      verified: e.verified, categories: e.categories,
      rateTier: e.rateTier, ratePerMinute: e.ratePerMinute,
      education: e.education, yearsExperience: e.yearsExperience,
      onboardingComplete: e.onboardingComplete,
    }).catch(() => {});
  }
  function syncCreditTxToCloud(tx: { userId: number; amount: number; type: string; description: string; takeRatePercent?: number | null; platformFee?: number | null; expertPayout?: number | null; clientPaid?: number | null }) {
    writeCreditTransactionToCloudSql(tx).catch(() => {});
  }

  // ─── Build 39 Fix 2: Payout reconciliation REMOVED ───
  // Cloud SQL is the source of truth for wallet_balance. The restore in index.ts
  // copies correct values before the server starts. Separate reconciliation was
  // causing double-deduction because GCS backup is empty → seed data has $315 →
  // Cloud SQL restore overwrites to $100 → reconciliation would deduct again.
  // The payout_reconcile_log table still exists for audit trail / future use.

  // Rate limiting on auth endpoints
  // Fix 2: Tighter rate limiting — 10 requests per 15 min for auth, 5 for registration
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: true, message: "Too many attempts, please try again later", code: "RATE_LIMITED" },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
  });

  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 5, // 5 registrations per IP per hour
    message: { error: true, message: "Too many registration attempts, please try again later", code: "RATE_LIMITED" },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
  });

  // ─── Email Notification Stub ───
  function sendEmailNotification(userId: number, subject: string, body: string) {
    console.log(`[EMAIL] userId=${userId} subject="${subject}" body="${body}"`);
  }

  // ─── OTP helpers ───
  function generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function hashOtp(otp: string): string {
    return crypto.createHash("sha256").update(otp).digest("hex");
  }

  // OTP store: email -> { hash, expiry, name }
  const otpStore = new Map<string, { hash: string; expiry: number; name: string }>();

  // ─── AUTH ───

  // POST /api/auth/register — send OTP to new user
  app.post("/api/auth/register", registerLimiter, async (req, res) => {
    try {
      const data = otpRegisterSchema.parse(req.body);
      const { name, email, role } = data;

      // Check if email already exists
      const existing = storage.getUserByEmail(email);
      if (existing) {
        // User exists — treat as login (send OTP)
        const otp = generateOtp();
        otpStore.set(email, { hash: hashOtp(otp), expiry: Date.now() + 10 * 60 * 1000, name: existing.name });
        try { await sendOtpEmail(email, existing.name, otp); } catch (emailErr) { console.error("[OTP] Email send error:", emailErr); }
        return res.json({ message: "OTP sent", email, existing: true });
      }

      // New user — create account
      // FIX-2: EVERY new user gets 5 credits and a welcome bonus transaction — NO EXCEPTIONS
      // Fix 1: XSS — sanitize user-provided name
      const safeName = sanitizeHtml(name.trim());
      const user = storage.createUser({
        username: email, // use email as username
        password: "",
        name: safeName,
        email,
        role,
        credits: 5, // FIX-2: 5 welcome credits — required for all registration paths
        company: null,
        accountType: "individual",
        walletBalance: 0,
        active: 1,
      });

      // FIX-2: Create welcome bonus transaction so credit history is correct
      storage.createTransaction({
        userId: user.id,
        amount: 5,
        type: "bonus",
        description: "Welcome bonus — $5 free credits",
      });
      // Log Terms of Use and Privacy Policy acceptance
      const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown";
      const ua = req.headers["user-agent"] || "unknown";
      const now = new Date().toISOString();
      try {
        sqlite.prepare("INSERT INTO legal_acceptances (user_id, document_type, document_version, accepted_at, ip_address, user_agent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(user.id, "terms_of_use", "April 2026", now, ip, ua, now, now);
        sqlite.prepare("INSERT INTO legal_acceptances (user_id, document_type, document_version, accepted_at, ip_address, user_agent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(user.id, "privacy_policy", "April 2026", now, ip, ua, now, now);
        console.log(`[LEGAL] Terms accepted by user ${user.id} from ${ip}`);
      } catch(e) { console.error("[LEGAL] Failed to log acceptance:", e); }
      createAndSyncNotification({
        userId: user.id,
        title: "Welcome to A2A Expert Opinion!",
        message: "You've received $5 free credits to get started. Submit your first request today.",
        type: "welcome",
        read: 0,
        createdAt: new Date().toISOString(),
      });

      if (role === "expert") {
        storage.createExpert({
          userId: user.id,
          bio: "", expertise: "", credentials: "",
          rating: 50, totalReviews: 0, verified: 0,
          categories: "[]", availability: 0,
          hourlyRate: null, responseTime: null,
          education: "", yearsExperience: 0,
          onboardingComplete: 0, verificationScore: null,
          ratePerMinute: null, rateTier: null,
        });
      }

      // Save UTM / acquisition source
      const { utmSource, utmMedium, utmCampaign, utmContent, referrer, landingPage } = req.body;
      if (utmSource || utmMedium || referrer) {
        sqlite.prepare("INSERT INTO registration_sources (user_id, utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_page, created_at) VALUES (?,?,?,?,?,?,?,?)").run(
          user.id, utmSource || null, utmMedium || null, utmCampaign || null, utmContent || null,
          referrer || null, landingPage || null, new Date().toISOString()
        );
      }

      // Trigger backup after new user registration
      triggerBackup();

      // MISSION CRITICAL: 4-layer data persistence
      const userData = {
        id: user.id, name: user.name, email: user.email, role: user.role,
        company: user.company, credits: user.credits,
        utmSource: utmSource || null, utmMedium: utmMedium || null, utmCampaign: utmCampaign || null,
      };
      writeUserToBigQuery(userData).catch(() => {});      // Layer 2: BigQuery
      writeUserToCloudSql(userData).catch(() => {});       // Layer 4: Cloud SQL
      sendUserRegistrationEmail(userData).catch(() => {}); // Layer 3: Excel email

      // Generate and send OTP
      const otp = generateOtp();
      otpStore.set(email, { hash: hashOtp(otp), expiry: Date.now() + 10 * 60 * 1000, name });
      try { await sendOtpEmail(email, name, otp); } catch (emailErr) { console.error("[OTP] Email send error:", emailErr); }

      return res.json({ message: "OTP sent", email });
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  // POST /api/auth/verify-otp — verify OTP after registration
  app.post("/api/auth/verify-otp", authLimiter, async (req, res) => {
    try {
      const { email, otp } = otpVerifySchema.parse(req.body);
      const entry = otpStore.get(email);
      if (!entry) {
        return res.status(400).json({ error: true, message: "No OTP pending for this email", code: "OTP_NOT_FOUND" });
      }
      if (Date.now() > entry.expiry) {
        otpStore.delete(email);
        return res.status(400).json({ error: true, message: "OTP has expired", code: "OTP_EXPIRED" });
      }
      if (hashOtp(otp) !== entry.hash) {
        return res.status(400).json({ error: true, message: "Invalid verification code", code: "OTP_INVALID" });
      }
      otpStore.delete(email);

      const user = storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: true, message: "User not found" });
      }
      if (user.active === 0) {
        return res.status(403).json({ error: true, message: "Account deactivated", code: "ACCOUNT_DISABLED" });
      }
      // OB-B: Increment login count
      const newLoginCount = (user.loginCount ?? 0) + 1;
      storage.updateUser(user.id, { loginCount: newLoginCount } as any);
      const updatedUser = storage.getUser(user.id)!;
      const { password: _, ...safeUser } = updatedUser;
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      syncUserToCloud(user.id);
      return res.json({ ...safeUser, token });
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  // POST /api/auth/login — send OTP for existing user
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email } = otpLoginSchema.parse(req.body);
      // Try by email first, then by username (users are stored with username=email)
      const user = storage.getUserByEmail(email) || storage.getUserByUsername(email);
      if (!user) {
        return res.status(404).json({
          error: true,
          message: "No account found with this email. Please register first.",
          code: "USER_NOT_FOUND",
        });
      }
      if (user.active === 0) {
        return res.status(403).json({ error: true, message: "Account deactivated", code: "ACCOUNT_DISABLED" });
      }
      const otp = generateOtp();
      otpStore.set(email, { hash: hashOtp(otp), expiry: Date.now() + 10 * 60 * 1000, name: user.name });
      try { await sendOtpEmail(email, user.name, otp); } catch (emailErr) { console.error("[OTP] Email send error:", emailErr); }
      return res.json({ message: "OTP sent" });
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  // POST /api/auth/verify-login — verify OTP for login
  app.post("/api/auth/verify-login", authLimiter, async (req, res) => {
    try {
      const { email, otp } = otpVerifySchema.parse(req.body);
      const entry = otpStore.get(email);
      if (!entry) {
        return res.status(400).json({ error: true, message: "No OTP pending for this email", code: "OTP_NOT_FOUND" });
      }
      if (Date.now() > entry.expiry) {
        otpStore.delete(email);
        return res.status(400).json({ error: true, message: "OTP has expired", code: "OTP_EXPIRED" });
      }
      if (hashOtp(otp) !== entry.hash) {
        return res.status(400).json({ error: true, message: "Invalid verification code", code: "OTP_INVALID" });
      }
      otpStore.delete(email);

      const user = storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: true, message: "User not found" });
      }
      if (user.active === 0) {
        return res.status(403).json({ error: true, message: "Account deactivated", code: "ACCOUNT_DISABLED" });
      }
      // OB-B: Increment login count
      const newLoginCount = (user.loginCount ?? 0) + 1;
      storage.updateUser(user.id, { loginCount: newLoginCount } as any);
      const updatedUser = storage.getUser(user.id)!;
      const { password: _, ...safeUser } = updatedUser;
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      syncUserToCloud(user.id);
      return res.json({ ...safeUser, token });
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: true, message: "No token" });
    const token = authHeader.replace("Bearer ", "");
    const session = storage.getSession(token);
    if (!session) return res.status(401).json({ error: true, message: "Invalid session" });
    if (new Date(session.expiresAt) < new Date()) {
      storage.deleteSession(token);
      return res.status(401).json({ error: true, message: "Session expired" });
    }
    const user = storage.getUser(session.userId);
    if (!user) return res.status(401).json({ error: true, message: "User not found" });
    const { password: _, ...safeUser } = user;
    return res.json(safeUser);
  });

  app.get("/api/auth/user/:id", userOrAdminAuth, async (req, res) => {
    const requestedId = parseInt(String(req.params.id));
    const authUser = (req as any).authUser;
    // Allow if admin or if the authenticated user is requesting their own profile
    if (authUser.role !== "admin" && authUser.id !== requestedId) {
      return res.status(403).json({ error: true, message: "Access denied" });
    }
    const user = storage.getUser(requestedId);
    if (!user) return res.status(404).json({ error: true, message: "User not found" });
    const { password: _, ...safeUser } = user;
    return res.json(safeUser);
  });

  // ─── SSE REAL-TIME EVENTS ───
  app.get("/api/events/:userId", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });
    const userId = Number(req.params.userId);
    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    // Store connection (support multiple tabs)
    if (!activeConnections.has(userId)) {
      activeConnections.set(userId, new Set());
    }
    activeConnections.get(userId)!.add(sendEvent);
    // Send heartbeat every 30s
    const heartbeat = setInterval(() => { res.write(":heartbeat\n\n"); }, 30000);
    req.on("close", () => {
      clearInterval(heartbeat);
      const senders = activeConnections.get(userId);
      if (senders) {
        senders.delete(sendEvent);
        if (senders.size === 0) activeConnections.delete(userId);
      }
    });
  });

  // ─── REQUEST TIMELINE ───
  app.get("/api/requests/:id/timeline", userOrAdminAuth, async (req, res) => {
    const events = storage.getRequestEventsByRequest(parseInt(req.params.id));
    return res.json(events);
  });

  // ─── REQUEST MESSAGE (timeline messaging) ───
  // Both client and expert can send messages. Follow-up count is tracked for client messages.
  app.post("/api/requests/:id/message", userOrAdminAuth, async (req, res) => {
    const requestId = parseInt(req.params.id);
    const { actorId, actorName, message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: true, message: "Message required" });

    const request = storage.getRequest(requestId);
    if (!request) return res.status(404).json({ error: true, message: "Request not found" });

    // G4-3: Enforce 2+2 message limit — reject if both sides already sent ≥2 messages
    const existingEvents = storage.getRequestEventsByRequest(requestId);
    const msgEvents = existingEvents.filter((e: any) => e.type === "message");
    const clientMsgs = msgEvents.filter((e: any) => e.actorId === request.userId).length;
    const expertMsgs = msgEvents.filter((e: any) => e.actorId != null && e.actorId !== request.userId).length;
    if (clientMsgs >= 2 && expertMsgs >= 2) {
      return res.status(400).json({ error: true, message: "Chat limit reached (2 messages each)" });
    }

    // Determine if sender is the client (for follow-up counting)
    const isClientMessage = actorId === request.userId;
    let autoCompleted = false;

    // If request is in awaiting_followup and this is a client follow-up, track count
    if (isClientMessage && request.status === "awaiting_followup") {
      const currentCount: number = (request as any).followup_count ?? 0;
      const newCount = currentCount + 1;
      sqlite.prepare("UPDATE requests SET followup_count = ? WHERE id = ?").run(newCount, requestId);

      // Auto-complete if 2 follow-ups have been used
      if (newCount >= 2) {
        await finalizeRequest(requestId);
        autoCompleted = true;
      }
    }

    // Check deadline auto-complete (3 hours since expert responded with no client action)
    if (!autoCompleted && request.status === "awaiting_followup") {
      const deadline = (request as any).followup_deadline;
      if (deadline && new Date() > new Date(deadline)) {
        await finalizeRequest(requestId);
        autoCompleted = true;
      }
    }

    logRequestEvent(requestId, "message", actorId, actorName, message);

    // Notify the other party
    const clientUser = storage.getUser(request.userId);
    if (request.expertId) {
      const expert = storage.getExpert(request.expertId);
      if (expert) {
        const expertUser = storage.getUser(expert.userId);
        if (expertUser && actorId !== expertUser.id) {
          // FIX-4 + FIX-followup: Follow-up notification with request link so expert can navigate
          const notifTitle = `Follow-up on "${request.title}"`;
          const notifMessage = `${actorName}: ${message.substring(0, 100)}`;
          const notifLink = `/expert?request=${requestId}`;
          createAndSyncNotification({
            userId: expertUser.id,
            title: notifTitle,
            message: notifMessage,
            type: "follow_up",
            read: 0,
            link: notifLink,
            createdAt: new Date().toISOString(),
          });
          notifyUser(expertUser.id, { type: "follow_up", title: notifTitle, message: notifMessage, requestId, link: notifLink } as any);
        }
        // If expert is responding to a follow-up, notify client
        if (expertUser && actorId === expertUser.id && clientUser) {
          const notifTitle = `Expert replied on "${request.title}"`;
          const notifMessage = `${actorName}: ${message.substring(0, 100)}`;
          createAndSyncNotification({
            userId: clientUser.id,
            title: notifTitle,
            message: notifMessage,
            type: "expert_reply",
            read: 0,
            link: `/dashboard?request=${requestId}`,
            createdAt: new Date().toISOString(),
          });
          notifyUser(clientUser.id, { type: "expert_reply", title: notifTitle, message: notifMessage, requestId } as any);
        }
      }
    }
    if (clientUser && actorId !== clientUser.id) {
      notifyUser(clientUser.id, { type: "message", title: "New Message", message: `${actorName}: ${message.substring(0, 100)}`, requestId } as any);
    }

    triggerBackup();
    return res.json({ ok: true, autoCompleted });
  });

  // ─── BACKUP TEST & HEALTH ───
  app.get("/api/admin/backup-test", adminAuth, async (_req, res) => {
    try {
      const { backupDatabase, isBackupHealthy } = await import("./db-persistence");
      const beforeStatus = isBackupHealthy();
      await backupDatabase();
      const afterStatus = isBackupHealthy();
      res.json({ 
        ok: afterStatus, 
        wasHealthy: beforeStatus,
        message: afterStatus 
          ? "Backup successful. User data is safe." 
          : "BACKUP FAILED. Check Cloud Run logs. Run: gcloud storage buckets add-iam-policy-binding gs://a2a-global-data --member=serviceAccount:506299896481-compute@developer.gserviceaccount.com --role=roles/storage.admin --project=winter-jet-492110-g9"
      });
    } catch (err: any) {
      res.json({ ok: false, error: err.message });
    }
  });

  app.get("/api/health", async (_req, res) => {
    const { isBackupHealthy } = await import("./db-persistence");
    const userCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM users").get() as any;
    const backupOk = isBackupHealthy();
    // Bug-2 fix: Grace period on cold start — don't alarm if server started < 10 min ago
    const uptimeMs = Date.now() - SERVER_START_TIME;
    const coldStart = uptimeMs < 10 * 60 * 1000;
    const effectiveHealthy = backupOk || coldStart;
    res.json({
      status: "running",
      backupHealthy: effectiveHealthy,
      totalUsers: userCount?.cnt || 0,
      warning: !effectiveHealthy ? "DATABASE BACKUP IS NOT WORKING. User data will be lost on next deploy." : null,
      ...(coldStart && !backupOk ? { note: "Server just started, initial backup pending" } : {}),
    });
  });

  // ─── TRACKING ───

  app.post("/api/track/pageview", (req, res) => {
    const { path, utmSource, utmMedium, utmCampaign, utmContent, referrer, sessionId } = req.body;
    const pvNow = new Date().toISOString();
    sqlite.prepare("INSERT INTO page_views (path, utm_source, utm_medium, utm_campaign, utm_content, referrer, user_agent, ip_address, session_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(
      path, utmSource || null, utmMedium || null, utmCampaign || null, utmContent || null,
      referrer || null, req.headers["user-agent"] || null, req.ip || null, sessionId || null,
      pvNow, pvNow
    );
    res.json({ ok: true });
  });

  // ─── ADMIN OPERATIONAL METRICS ───
  app.get("/api/admin/metrics", adminAuth, async (_req, res) => {
    const allRequests = storage.getAllRequests();
    const allExperts = storage.getAllExperts();
    const allEvents = allRequests.flatMap((r) => {
      return storage.getRequestEventsByRequest(r.id);
    });

    // Avg time to claim
    let totalClaimTime = 0, claimCount = 0;
    const requestSubmitTimes = new Map<number, string>();
    allEvents.forEach((e) => { if (e.type === "submitted") requestSubmitTimes.set(e.requestId, e.createdAt); });
    allEvents.forEach((e) => {
      if (e.type === "claimed") {
        const submitTime = requestSubmitTimes.get(e.requestId);
        if (submitTime) {
          const diff = (new Date(e.createdAt).getTime() - new Date(submitTime).getTime()) / 60000;
          totalClaimTime += diff; claimCount++;
        }
      }
    });
    const avgTimeToClaim = claimCount > 0 ? Math.round(totalClaimTime / claimCount) : 0;

    // Avg time to complete
    const claimTimes = new Map<number, string>();
    allEvents.forEach((e) => { if (e.type === "claimed") claimTimes.set(e.requestId, e.createdAt); });
    let totalCompleteTime = 0, completeCount = 0;
    allEvents.forEach((e) => {
      if (e.type === "completed") {
        const claimTime = claimTimes.get(e.requestId);
        if (claimTime) {
          const diff = (new Date(e.createdAt).getTime() - new Date(claimTime).getTime()) / 60000;
          totalCompleteTime += diff; completeCount++;
        }
      }
    });
    const avgTimeToComplete = completeCount > 0 ? Math.round(totalCompleteTime / completeCount) : 0;

    // Expert utilization (verified experts who completed at least 1 request in last 7 days)
    const verifiedExperts = allExperts.filter((e) => e.verified === 1);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const recentlyActive = new Set<number>();
    allEvents.forEach((e) => {
      if (e.type === "completed" && e.createdAt > sevenDaysAgo && e.actorId) {
        recentlyActive.add(e.actorId);
      }
    });
    const expertUtilization = verifiedExperts.length > 0 ? Math.round((recentlyActive.size / verifiedExperts.length) * 100) : 0;

    // Supply/demand by category
    const categories = ["finance", "business", "entrepreneurship"];
    const categoryStats = categories.map((cat) => {
      const pending = allRequests.filter((r) => r.status === "pending" && r.category === cat).length;
      const available = allExperts.filter((e) => {
        try {
          const cats = JSON.parse(e.categories || "[]");
          return cats.includes(cat) && e.verified === 1 && e.availability === 1;
        } catch { return false; }
      }).length;
      const total = allRequests.filter((r) => r.category === cat).length;
      return { category: cat, pending, available, total };
    });

    const totalPending = allRequests.filter((r) => r.status === "pending").length;
    const activeExperts = allExperts.filter((e) => e.verified === 1 && e.availability === 1).length;
    const supplyDemandRatio = activeExperts > 0 ? (totalPending / activeExperts).toFixed(1) : "N/A";

    return res.json({
      avgTimeToClaim,
      avgTimeToComplete,
      expertUtilization,
      supplyDemandRatio,
      categoryStats,
    });
  });

  // ─── ADMIN AUTH ───

  app.post("/api/admin/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: true, message: "Email and password required" });
      const admin = storage.getAdminByEmail(email);
      if (!admin) return res.status(401).json({ error: true, message: "Invalid credentials" });
      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) return res.status(401).json({ error: true, message: "Invalid credentials" });
      const { password: _, ...safeAdmin } = admin;
      const token = signAdminToken(safeAdmin);
      return res.json({ ...safeAdmin, token });
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  // ─── ADMIN DATA ROUTES ───

  app.get("/api/admin/stats", adminAuth, async (_req, res) => {
    try {
      const allUsers = storage.getAllUsers();
      const allExperts = storage.getAllExperts();
      const allRequests = storage.getAllRequests();
      const allCreditTx = storage.getAllCreditTransactions();
      const allWithdrawals = storage.getAllWithdrawals();

      const verifiedExperts = allExperts.filter(e => e.verified === 1).length;
      const pendingExperts = allExperts.filter(e => e.verified === 0).length;
      const activeRequests = allRequests.filter(r => r.status === "pending" || r.status === "in_progress").length;
      const completedRequests = allRequests.filter(r => r.status === "completed").length;

      // Revenue = sum of all credit purchases (what clients paid in)
      const totalRevenuePurchases = allCreditTx
        .filter(t => t.type === "purchase")
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      // Also count charged transactions (credits deducted for completed services)
      const totalRevenueCharged = allCreditTx
        .filter(t => t.type === "charged" || t.type === "debit")
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      // Use max of purchases vs charged as totalRevenue (purchases = platform gross)
      const totalRevenue = Math.round(totalRevenuePurchases + totalRevenueCharged);

      const totalPayouts = allWithdrawals
        .filter(w => w.status === "approved")
        .reduce((sum, w) => sum + w.amountCents, 0);

      // Calculate avg take rate from actual data
      const allTierRates = allRequests
        .filter(r => r.status === "completed")
        .map(r => TAKE_RATES[(r.priceTier || r.tier || "standard").toLowerCase()] ?? 0.50);
      const avgTakeRate = allTierRates.length > 0
        ? Math.round((allTierRates.reduce((s, v) => s + v, 0) / allTierRates.length) * 100) / 100
        : 0.30;

      return res.json({
        totalUsers: allUsers.length,
        totalExperts: allExperts.length,
        verifiedExperts,
        pendingExperts,
        activeRequests,
        completedRequests,
        totalRequests: allRequests.length,
        totalRevenue,
        totalPayouts,
        avgTakeRate,
      });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  app.get("/api/admin/users", adminAuth, async (_req, res) => {
    const allUsers = storage.getAllUsers();
    return res.json(allUsers.map(u => {
      const { password: _, ...safe } = u;
      return safe;
    }));
  });

  app.get("/api/admin/experts", adminAuth, async (_req, res) => {
    const allExperts = storage.getAllExperts();
    const allUsers = storage.getAllUsers();
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    return res.json(allExperts.map(e => ({
      ...e,
      userName: userMap.get(e.userId)?.name || "Unknown",
      userEmail: userMap.get(e.userId)?.email || "",
    })));
  });

  app.get("/api/admin/requests", adminAuth, async (_req, res) => {
    const allRequests = storage.getAllRequests();
    const allUsers = storage.getAllUsers();
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    return res.json(allRequests.map(r => ({
      ...r,
      clientName: userMap.get(r.userId)?.name || "Unknown",
    })));
  });

  app.get("/api/admin/transactions", adminAuth, async (_req, res) => {
    try {
    // FIX-11: Use safeArray to ensure arrays are always iterable
    const allTx = safeArray(storage.getAllCreditTransactions());
    const allUsers = safeArray(storage.getAllUsers());
    const allRequests = safeArray(storage.getAllRequests());
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    const enrichedTx = allTx.map(t => {
      const base = { ...t, userName: userMap.get(t.userId)?.name || "Unknown" };

      // Use stored take rate fields if available (post-migration)
      if (t.takeRatePercent != null) {
        let matchedRequest: typeof allRequests[0] | undefined;
        if (t.description) {
          for (const r of allRequests) {
            if (t.description.includes(r.title)) { matchedRequest = r; break; }
          }
        }
        return {
          ...base,
          requestId: matchedRequest?.id,
          requestTitle: matchedRequest?.title,
          tier: matchedRequest?.tier,
          priceTier: matchedRequest?.priceTier,
          clientPaid: t.clientPaid,
          expertPayout: t.expertPayout,
          platformFee: t.platformFee,
          takeRatePercent: t.takeRatePercent,
        };
      }

      // Fallback: compute from request data (pre-migration transactions)
      let matchedRequest: typeof allRequests[0] | undefined;
      if (t.description) {
        for (const r of allRequests) {
          if (t.description.includes(r.title)) { matchedRequest = r; break; }
        }
      }
      if (!matchedRequest) return base;

      const tier = (matchedRequest.priceTier || matchedRequest.tier || "standard").toLowerCase();
      const takeRatePercent = Math.round((TAKE_RATES[tier] ?? 0.50) * 100);
      const takeRate = TAKE_RATES[tier] ?? 0.50;
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

    // Compute totals for completed (charged) transactions
    const chargedTx = enrichedTx.filter(t => t.type === "charged");
    const totalClientPaid = chargedTx.reduce((s, t) => s + ((t as any).clientPaid || 0), 0);
    const totalExpertPayout = chargedTx.reduce((s, t) => s + ((t as any).expertPayout || 0), 0);
    const totalPlatformFees = chargedTx.reduce((s, t) => s + ((t as any).platformFee || 0), 0);

    return res.json({
      transactions: enrichedTx,
      totals: { totalClientPaid, totalExpertPayout, totalPlatformFees },
    });
    } catch (e: any) {
      console.error("[admin/transactions] error:", e);
      return res.status(500).json({ error: true, message: e.message, transactions: [], totals: { totalClientPaid: 0, totalExpertPayout: 0, totalPlatformFees: 0 } });
    }
  });

  app.get("/api/admin/wallet-transactions", adminAuth, async (_req, res) => {
    const allTx = storage.getAllWalletTransactions();
    const allUsers = storage.getAllUsers();
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    return res.json(allTx.map(t => ({
      ...t,
      userName: userMap.get(t.userId)?.name || "Unknown",
    })));
  });

  app.get("/api/admin/withdrawals", adminAuth, async (_req, res) => {
    const allW = storage.getAllWithdrawals();
    const allUsers = storage.getAllUsers();
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    return res.json(allW.map(w => ({
      ...w,
      userName: userMap.get(w.userId)?.name || "Unknown",
    })));
  });

  app.post("/api/admin/withdrawals/:id/approve", adminAuth, async (req, res) => {
    try {
      const w = storage.updateWithdrawal(parseInt(String(req.params.id)), {
        status: "approved",
        processedAt: new Date().toISOString(),
      });
      if (!w) return res.status(404).json({ error: true, message: "Withdrawal not found" });
      createAndSyncNotification({
        userId: w.userId,
        title: "Withdrawal Approved",
        message: `Your withdrawal of $${(w.amountCents / 100).toFixed(2)} has been approved and will be processed within 3-5 business days.`,
        type: "withdrawal_approved",
        read: 0,
        createdAt: new Date().toISOString(),
      });
      return res.json(w);
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  app.post("/api/admin/withdrawals/:id/reject", adminAuth, async (req, res) => {
    try {
      const wOld = storage.getAllWithdrawals().find(w => w.id === parseInt(String(req.params.id)));
      if (!wOld) return res.status(404).json({ error: true, message: "Withdrawal not found" });
      // Refund the user's wallet
      const user = storage.getUser(wOld.userId);
      if (user) {
        storage.updateUser(user.id, { walletBalance: user.walletBalance + wOld.amountCents });
      }
      const w = storage.updateWithdrawal(parseInt(String(req.params.id)), {
        status: "rejected",
        processedAt: new Date().toISOString(),
      });
      createAndSyncNotification({
        userId: wOld.userId,
        title: "Withdrawal Rejected",
        message: `Your withdrawal of $${(wOld.amountCents / 100).toFixed(2)} was rejected. The funds have been returned to your wallet.`,
        type: "withdrawal_rejected",
        read: 0,
        createdAt: new Date().toISOString(),
      });
      return res.json(w);
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  app.post("/api/admin/users/:id/add-credits", adminAuth, async (req, res) => {
    try {
      const { amount } = req.body;
      const user = storage.getUser(parseInt(String(req.params.id)));
      if (!user) return res.status(404).json({ error: true, message: "User not found" });
      storage.updateUser(user.id, { credits: user.credits + amount });
      storage.createTransaction({
        userId: user.id, amount, type: "admin_grant",
        description: `Admin granted ${amount} credits`,
      });
      syncUserToCloud(user.id);
      syncCreditTxToCloud({ userId: user.id, amount, type: "admin_grant", description: `Admin granted ${amount} credits` });
      writeUserToBigQuery({ id: user.id, name: user.name, email: user.email, role: user.role, company: user.company, credits: user.credits + amount, createdAt: user.createdAt || undefined }).catch(() => {});
      return res.json({ credits: user.credits + amount });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  app.post("/api/admin/users/:id/deactivate", adminAuth, async (req, res) => {
    try {
      const user = storage.updateUser(parseInt(String(req.params.id)), { active: 0 } as any);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });
      syncUserToCloud(user.id);
      return res.json(user);
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  app.post("/api/admin/users/:id/activate", adminAuth, async (req, res) => {
    try {
      const user = storage.updateUser(parseInt(String(req.params.id)), { active: 1 } as any);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });
      syncUserToCloud(user.id);
      return res.json(user);
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  app.post("/api/admin/requests/:id/refund", adminAuth, async (req, res) => {
    try {
      const request = storage.getRequest(parseInt(String(req.params.id)));
      if (!request) return res.status(404).json({ error: true, message: "Request not found" });
      if (request.refunded === 1) return res.status(400).json({ error: true, message: "Already refunded" });
      const user = storage.getUser(request.userId);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });
      storage.updateRequest(request.id, { refunded: 1 });
      storage.updateUser(user.id, { credits: user.credits + request.creditsCost });
      storage.createTransaction({
        userId: user.id, amount: request.creditsCost, type: "refund",
        description: `Admin refund: ${request.title}`,
      });
      createAndSyncNotification({
        userId: user.id,
        title: "Refund Processed",
        message: `$${request.creditsCost} credits have been refunded for "${request.title}".`,
        type: "refund",
        read: 0,
        createdAt: new Date().toISOString(),
      });
      syncUserToCloud(user.id);
      syncRequestToCloud(request.id);
      syncCreditTxToCloud({ userId: user.id, amount: request.creditsCost, type: "refund", description: `Admin refund: ${request.title}` });
      writeUserToBigQuery({ id: user.id, name: user.name, email: user.email, role: user.role, company: user.company, credits: user.credits + request.creditsCost, createdAt: user.createdAt || undefined }).catch(() => {});
      return res.json({ message: "Refunded" });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  app.get("/api/admin/settings", adminAuth, async (_req, res) => {
    return res.json({
      takeRates: TAKE_RATES,
      creditPacks: CREDIT_PACKS,
      admins: storage.getAllAdmins().map(a => ({ id: a.id, email: a.email, name: a.name })),
    });
  });

  app.get("/api/admin/notifications", adminAuth, async (_req, res) => {
    // Get last 100 notifications across all users
    const allUsers = storage.getAllUsers();
    const allNotifs: any[] = [];
    for (const u of allUsers) {
      const notifs = storage.getNotificationsByUser(u.id);
      allNotifs.push(...notifs.map(n => ({ ...n, userName: u.name })));
    }
    allNotifs.sort((a, b) => b.id - a.id);
    return res.json(allNotifs.slice(0, 100));
  });

  // ─── Expert routes ───

  app.get("/api/experts", async (_req, res) => {
    const allExperts = storage.getAllExperts();
    return res.json(allExperts);
  });

  app.get("/api/experts/:id", async (req, res) => {
    const expert = storage.getExpert(parseInt(req.params.id));
    if (!expert) return res.status(404).json({ error: true, message: "Expert not found" });
    // OB-G: Include user name so public profile and other views can show actual name
    const expertUser = storage.getUser(expert.userId);
    return res.json({ ...expert, userName: expertUser?.name || null });
  });

  app.get("/api/experts/user/:userId", async (req, res) => {
    const expert = storage.getExpertByUserId(parseInt(req.params.userId));
    if (!expert) return res.status(404).json({ error: true, message: "Expert not found" });
    return res.json(expert);
  });

  app.patch("/api/experts/:id", userOrAdminAuth, async (req, res) => {
    const authUser = (req as any).authUser;
    const existingExpert = storage.getExpert(parseInt(req.params.id));
    if (existingExpert && authUser.role !== "admin" && existingExpert.userId !== authUser.id) return res.status(403).json({ error: true, message: "Forbidden", code: "FORBIDDEN" });
    // Fix 1: XSS — sanitize expert string fields
    const sanitizedBody = sanitizeObject(req.body, ['bio', 'expertise', 'credentials', 'education']);
    const expert = storage.updateExpert(parseInt(req.params.id), sanitizedBody);
    if (!expert) return res.status(404).json({ error: true, message: "Expert not found" });
    syncExpertToCloud(expert.id);
    return res.json(expert);
  });

  // Expert public profile — returns only public-safe fields (no sensitive data)
  app.get("/api/experts/:expertId/public-profile", async (req, res) => {
    try {
      const expertId = parseInt(req.params.expertId);
      const expert = storage.getExpert(expertId);
      if (!expert) return res.status(404).json({ error: true, message: "Expert not found" });
      const user = storage.getUser(expert.userId);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });
      let categories: string[] = [];
      try { categories = JSON.parse(expert.categories || "[]"); } catch {}
      return res.json({
        id: expert.id,
        name: user.name,
        bio: expert.bio,
        expertise: expert.expertise,
        credentials: expert.credentials,
        education: expert.education,
        yearsExperience: expert.yearsExperience,
        rating: expert.rating,
        totalReviews: expert.totalReviews,
        tier: normalizeTier(expert.rateTier),
        categories,
        responseTime: expert.responseTime,
        verified: expert.verified === 1,
        availability: expert.availability === 1,
        photoUrl: user?.photo ? `/api/users/${user.id}/photo` : null,
      });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // ─── Request routes ───

  app.get("/api/requests/user/:userId", userOrAdminAuth, async (req, res) => {
    if (!ownerOrAdmin(req, res, 'userId')) return;
    const reqs = storage.getRequestsByUser(parseInt(req.params.userId));
    return res.json(reqs);
  });

  app.get("/api/requests/expert/:expertId", userOrAdminAuth, async (req, res) => {
    // Verify authUser owns this expert record
    const authUser = (req as any).authUser;
    const expert = storage.getExpert(parseInt(req.params.expertId));
    if (authUser.role !== 'admin' && (!expert || expert.userId !== authUser.id)) {
      return res.status(403).json({ error: true, message: "Forbidden", code: "FORBIDDEN" });
    }
    const reqs = storage.getRequestsByExpert(parseInt(req.params.expertId));
    return res.json(reqs);
  });

  app.get("/api/requests/pending", userOrAdminAuth, async (_req, res) => {
    const reqs = storage.getPendingRequests();
    return res.json(reqs);
  });

  // NOTE: /drafts/:userId MUST be registered before /:id to avoid the wildcard catching it
  app.get("/api/requests/drafts/:userId", userOrAdminAuth, async (req, res) => {
    if (!ownerOrAdmin(req, res, 'userId')) return;
    const userId = parseInt(req.params.userId);
    const allRequests = storage.getRequestsByUser(userId);
    const drafts = allRequests.filter((r) => r.status === "draft");
    return res.json(drafts);
  });

  app.get("/api/requests/:id", userOrAdminAuth, async (req, res) => {
    const r = storage.getRequest(parseInt(req.params.id));
    if (!r) return res.status(404).json({ error: true, message: "Request not found" });
    // FIX-4 Approach 4: Ensure creditsCost is always in the response (not credit_cost)
    return res.json({ ...r, creditsCost: r.creditsCost });
  });

  // FIX-4 Approach 5: Dedicated price endpoint for debugging price mismatches
  app.get("/api/requests/:id/price", (req, res) => {
    const r = storage.getRequest(parseInt(req.params.id));
    if (!r) return res.status(404).json({ error: true, message: "Request not found" });
    return res.json({
      requestId: r.id,
      creditsCost: r.creditsCost,
      tier: r.tier,
      priceTier: r.priceTier,
      serviceType: r.serviceType,
    });
  });

  app.post("/api/requests", userOrAdminAuth, async (req, res) => {
    try {
      if (!ownerOrAdmin(req, res, 'userId', 'body')) return;
      const { userId, title, description, category, tier, serviceType, aiResponse, attachments: rawAttachments, expertsNeeded, instructions,
        llmProvider, llmModel, pricePerMinute, priceTier, serviceCategory, draftId, creditsCost: clientCreditsCost } = req.body;

      // CRITICAL-4: Strip large base64 data from inline attachments.
      // Attachments should be uploaded via POST /api/requests/:id/attachments (multipart/form-data).
      // If client sends attachments inline in the JSON body, keep only metadata (strip content/base64 fields).
      let attachments: string = "[]";
      if (rawAttachments) {
        try {
          const arr = Array.isArray(rawAttachments) ? rawAttachments : JSON.parse(rawAttachments);
          const stripped = arr.map((a: any) => {
            // Remove large base64 content fields
            const { content, base64, data, buffer, ...meta } = a;
            return meta;
          });
          attachments = JSON.stringify(stripped);
        } catch {
          attachments = "[]";
        }
      }

      // If submitting from a draft, delete the draft first
      if (draftId) {
        const draft = storage.getRequest(draftId);
        if (draft && draft.status === "draft") {
          storage.updateRequest(draftId, { status: "deleted" } as any);
        }
      }

      const sType = serviceType || "rate";
      const effectiveTier = (priceTier || tier || "standard").toLowerCase();
      const effectiveTakeRate = TAKE_RATES[effectiveTier] ?? 0.50;

      // Tier-based default costs (credits = dollars for this platform)
      // Standard: $5 base, Pro: $10 base, Guru: $15 base
      const tierBaseCost: Record<string, number> = { standard: 5, pro: 10, guru: 15 };
      const tierDefault = tierBaseCost[effectiveTier] ?? 5;

      let cost = 0;
      if (sType === "rate") {
        cost = Math.max(1, Math.min(10, expertsNeeded || 1));
        // Scale by tier for pro/guru
        if (effectiveTier === "pro") cost = Math.max(cost, 10);
        if (effectiveTier === "guru") cost = Math.max(cost, 15);
      } else if (sType === "review") {
        cost = effectiveTier === "guru" ? 15 : effectiveTier === "pro" ? 10 : 5;
      } else if (sType === "custom") {
        cost = effectiveTier === "guru" ? 20 : effectiveTier === "pro" ? 12 : 7;
      } else {
        // sense_check, consult, and any other type — use tier default
        cost = tierDefault;
      }

      // If pricePerMinute is provided (expert rate), override cost with rate-based calculation
      // client_rate = expert_rate / (1 - take_rate)
      let computedPricePerMinute = pricePerMinute || null;
      if (pricePerMinute && !isNaN(Number(pricePerMinute))) {
        const expertRate = Number(pricePerMinute);
        const clientRate = expertRate / (1 - effectiveTakeRate);
        computedPricePerMinute = clientRate.toFixed(4);
      }

      // FIX-4 Approach 2: Log cost calculation for debugging price mismatches
      console.log(`[REQUEST] Client sent creditsCost=${clientCreditsCost}, server calculated=${cost}`);

      // FIX-4 Approach 3: Server NEVER recalculates — stores EXACTLY what client sent.
      // The client UI already showed the price to the user; use that value.
      const finalCost = (clientCreditsCost && !isNaN(Number(clientCreditsCost)) && Number(clientCreditsCost) > 0)
        ? Number(clientCreditsCost)
        : (cost || 5); // Default to 5 if nothing sent
      cost = finalCost;
      console.log(`[REQUEST] Storing creditsCost=${finalCost}`);

      const user = storage.getUser(userId);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });
      if (user.credits < cost) return res.status(400).json({ error: true, message: "Insufficient credits" });

      // FEAT-011: Freeze (hold) credits on submit — deduct from wallet but mark as "hold"
      storage.updateUser(userId, { credits: user.credits - cost });
      const holdTakeRate = TAKE_RATES[(tier || "standard").toLowerCase()] ?? 0.50;
      const holdTakeRatePercent = Math.round(holdTakeRate * 100);
      const holdExpertPayout = Math.max(1, Math.floor(cost * (1 - holdTakeRate)));
      const holdPlatformFee = cost - holdExpertPayout;
      storage.createTransaction({
        userId, amount: -cost, type: "hold",
        description: `Credits frozen for request: ${title}`,
        takeRatePercent: holdTakeRatePercent,
        platformFee: holdPlatformFee,
        expertPayout: holdExpertPayout,
        clientPaid: cost,
      });

      // Fix 1: XSS — sanitize user-provided text fields
      const request = storage.createRequest({
        userId, title: sanitizeHtml(title || ''), description: sanitizeHtml(description || ''), category, tier,
        status: "pending", creditsCost: cost,
        expertId: null, expertResponse: null, deadline: null,
        serviceType: sType,
        aiResponse: aiResponse || null,
        attachments: attachments || "[]",
        expertsNeeded: sType === "rate" ? Math.max(1, Math.min(10, expertsNeeded || 1)) : 1,
        instructions: instructions || null,
        llmProvider: llmProvider || null,
        llmModel: llmModel || null,
        pricePerMinute: computedPricePerMinute,
        priceTier: priceTier || null,
        serviceCategory: serviceCategory || null,
        clientRating: null,
        clientRatingComment: null,
        refunded: 0,
      });

      const numReviews = sType === "rate" ? Math.max(1, Math.min(10, expertsNeeded || 1)) : 1;
      for (let i = 0; i < numReviews; i++) {
        storage.createExpertReview({
          requestId: request.id, expertId: null, status: "pending",
          rating: null, ratingComment: null,
          correctPoints: null, incorrectPoints: null, suggestions: null,
          deliverable: null, completedAt: null,
        });
      }

      // Log timeline event
      logRequestEvent(request.id, "submitted", userId, user.name);

      // Lifecycle notification: Request submitted
      createAndSyncNotification({
        userId,
        title: "Request Submitted",
        message: `Your request "${title}" in ${category} has been submitted successfully.`,
        type: "request_submitted",
        read: 0,
        link: `/dashboard?request=${request.id}`,
        createdAt: new Date().toISOString(),
      });
      notifyUser(userId, {
        type: "request_submitted",
        title: "Request Submitted",
        message: `Your request "${title}" has been submitted successfully.`,
        requestId: request.id,
      });
      // Email notification stub
      sendEmailNotification(userId, "Request Submitted", `Your request "${title}" in ${category} has been submitted successfully.`);

      // Notify matching experts via DB notifications + SSE
      const allExperts = storage.getAllExperts();
      for (const exp of allExperts) {
        if (exp.verified === 1 && exp.availability === 1) {
          try {
            const cats = JSON.parse(exp.categories || "[]");
            if (cats.includes(category)) {
              createAndSyncNotification({
                userId: exp.userId,
                title: "New Request Available",
                message: `A new ${sType} request "${title}" in ${category} is available for review.`,
                type: "new_request",
                read: 0,
                link: `/expert?view=queue`,
                createdAt: new Date().toISOString(),
              });
              // SSE push with Uber-style alert for expert — show expert net payout
              const expTier = (exp.rateTier || "standard").toLowerCase();
              const expTakeRate = TAKE_RATES[expTier] ?? 0.50;
              const expPayout = Math.max(1, Math.floor(cost * (1 - expTakeRate)));
              notifyUser(exp.userId, {
                type: "new_request",
                title: "\ud83d\udcb0 New Request Available!",
                message: `${title} — ${category} — earn $${expPayout} in ~10 min`,
                requestId: request.id,
              });
            }
          } catch {}
        }
      }

      // Sync to Cloud SQL
      syncUserToCloud(userId);
      syncRequestToCloud(request.id);
      syncCreditTxToCloud({ userId, amount: -cost, type: "hold", description: `Credits frozen for request: ${title}` });

      return res.json(request);
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  app.patch("/api/requests/:id", userOrAdminAuth, async (req, res) => {
    // Verify authUser is request owner, assigned expert, or admin
    const authUser = (req as any).authUser;
    const existing = storage.getRequest(parseInt(req.params.id));
    if (existing && authUser.role !== 'admin') {
      const isOwner = existing.userId === authUser.id;
      let isExpert = false;
      if (existing.expertId) { const exp = storage.getExpert(existing.expertId); isExpert = !!exp && exp.userId === authUser.id; }
      if (!isOwner && !isExpert) return res.status(403).json({ error: true, message: "Forbidden", code: "FORBIDDEN" });
    }
    const r = storage.updateRequest(parseInt(req.params.id), req.body);
    if (!r) return res.status(404).json({ error: true, message: "Request not found" });
    syncRequestToCloud(r.id);
    return res.json(r);
  });

  // ─── Draft Routes ───
  app.post("/api/requests/draft", userOrAdminAuth, async (req, res) => {
    try {
      if (!ownerOrAdmin(req, res, 'userId', 'body')) return;
      const { userId, title, description, category, serviceType, aiResponse, attachments, instructions,
        llmProvider, llmModel, serviceCategory } = req.body;
      const user = storage.getUser(userId);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });

      const request = storage.createRequest({
        userId,
        title: title || "",
        description: description || "",
        category: category || "",
        tier: "standard",
        status: "draft",
        creditsCost: 0,
        expertId: null,
        expertResponse: null,
        deadline: null,
        serviceType: serviceType || "sense_check",
        aiResponse: aiResponse || null,
        attachments: attachments || "[]",
        expertsNeeded: 1,
        instructions: instructions || null,
        llmProvider: llmProvider || null,
        llmModel: llmModel || null,
        pricePerMinute: null,
        priceTier: null,
        serviceCategory: serviceCategory || null,
        clientRating: null,
        clientRatingComment: null,
        refunded: 0,
      });
      return res.json(request);
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  app.patch("/api/requests/:id/draft", userOrAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = storage.getRequest(id);
      if (!existing) return res.status(404).json({ error: true, message: "Draft not found" });
      if (existing.status !== "draft") return res.status(400).json({ error: true, message: "Not a draft" });
      const authUser = (req as any).authUser;
      if (authUser.role !== 'admin' && existing.userId !== authUser.id) return res.status(403).json({ error: true, message: "Forbidden", code: "FORBIDDEN" });
      const updated = storage.updateRequest(id, req.body);
      return res.json(updated);
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  app.delete("/api/requests/:id/draft", userOrAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = storage.getRequest(id);
      if (!existing) return res.status(404).json({ error: true, message: "Draft not found" });
      const authUser = (req as any).authUser;
      if (authUser.role !== 'admin' && existing.userId !== authUser.id) return res.status(403).json({ error: true, message: "Forbidden", code: "FORBIDDEN" });
      if (existing.status !== "draft") return res.status(400).json({ error: true, message: "Not a draft" });
      // Use updateRequest to mark as deleted (soft delete by changing status)
      storage.updateRequest(id, { status: "deleted" } as any);
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  // ─── Custom Credit Top-Up ───
  app.post("/api/credits/topup", userOrAdminAuth, async (req, res) => {
    try {
      if (!ownerOrAdmin(req, res, 'userId', 'body')) return;
      const { userId, amountDollars } = req.body;
      const amount = Number(amountDollars);
      if (!amount || amount < 5 || amount > 10000) {
        return res.status(400).json({ error: true, message: "Amount must be between $5 and $10,000" });
      }
      const user = storage.getUser(userId);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });

      // 1 credit per $1
      const creditsToAdd = Math.round(amount);
      storage.updateUser(userId, { credits: user.credits + creditsToAdd });
      storage.createTransaction({
        userId, amount: creditsToAdd, type: "purchase",
        description: `Custom top-up — $${amount} — ${creditsToAdd} credits`,
      });
      storage.createWalletTransaction({
        userId,
        amountCents: Math.round(amount * 100),
        type: "topup",
        description: `Custom top-up: $${amount}`,
        createdAt: new Date().toISOString(),
        stripePaymentId: `mock_${uuidv4().slice(0, 8)}`,
      });
      syncUserToCloud(userId);
      syncCreditTxToCloud({ userId, amount: creditsToAdd, type: "purchase", description: `Custom top-up — $${amount}` });
      const updatedUser = storage.getUser(userId);
      if (updatedUser) {
        writeUserToBigQuery({ id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, company: updatedUser.company, credits: updatedUser.credits, createdAt: updatedUser.createdAt || undefined }).catch(() => {});
      }
      return res.json({ credits: updatedUser?.credits, success: true });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // Claim request (expert) — legacy
  app.post("/api/requests/:id/claim", userOrAdminAuth, async (req, res) => {
    // Verify authUser is an expert
    const authUser = (req as any).authUser;
    if (authUser.role !== 'admin' && authUser.role !== 'expert') {
      return res.status(403).json({ error: true, message: "Only experts can claim requests", code: "FORBIDDEN" });
    }
    const { expertId } = req.body;
    const r = storage.updateRequest(parseInt(req.params.id), {
      expertId, status: "in_progress",
    });
    if (!r) return res.status(404).json({ error: true, message: "Request not found" });

    // Notify client: expert assigned
    createAndSyncNotification({
      userId: r.userId,
      title: "Expert Assigned",
      message: `An expert has started working on your request "${r.title}".`,
      type: "claim",
      read: 0,
      link: `/dashboard?request=${r.id}`,
      createdAt: new Date().toISOString(),
    });
    notifyUser(r.userId, {
      type: "expert_assigned",
      title: "Expert Assigned",
      message: `An expert has started working on your request "${r.title}".`,
      requestId: r.id,
    });
    logRequestEvent(r.id, "claimed", expertId);
    syncRequestToCloud(r.id);

    return res.json(r);
  });

  // Submit expert response — sets status to awaiting_followup; credits charged only on final completion
  app.post("/api/requests/:id/respond", userOrAdminAuth, async (req, res) => {
    // Verify authUser is the assigned expert
    const authUser = (req as any).authUser;
    const existing = storage.getRequest(parseInt(req.params.id));
    if (existing && existing.expertId && authUser.role !== 'admin') {
      const exp = storage.getExpert(existing.expertId);
      if (!exp || exp.userId !== authUser.id) return res.status(403).json({ error: true, message: "Only the assigned expert can respond", code: "FORBIDDEN" });
    }
    const { expertResponse } = req.body;
    const followupDeadline = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(); // 3 hours from now
    const r = storage.updateRequest(parseInt(req.params.id), {
      expertResponse,
      status: "awaiting_followup",
      followup_deadline: followupDeadline,
    } as any);
    if (!r) return res.status(404).json({ error: true, message: "Request not found" });

    // Lifecycle notification: Response delivered, awaiting client follow-up
    createAndSyncNotification({
      userId: r.userId,
      title: "Expert Response Ready",
      message: `Expert has responded to your request "${r.title}". You may ask up to 2 follow-up questions within 3 hours.`,
      type: "response_ready",
      read: 0,
      link: `/dashboard?request=${r.id}`,
      createdAt: new Date().toISOString(),
    });
    notifyUser(r.userId, {
      type: "request_delivered",
      title: "Expert Response Ready",
      message: `Expert has responded to your request "${r.title}". You may ask up to 2 follow-up questions within 3 hours.`,
      requestId: r.id,
    });
    sendEmailNotification(r.userId, "Expert Response Ready", `Expert has responded to your request "${r.title}". View the response now.`);

    logRequestEvent(r.id, "responded", r.expertId || undefined);
    triggerBackup();
    syncRequestToCloud(r.id);
    return res.json(r);
  });

  // OB-I: finalizeRequest now ONLY credits the expert (client was already charged on admin approval)
  async function finalizeRequest(requestId: number): Promise<void> {
    const r = storage.getRequest(requestId);
    if (!r || r.status === "completed" || r.refunded) return;

    // Bug-1 fix: If expertResponse is null, copy from expert_reviews.deliverable first, then fall back to timeline
    if (!r.expertResponse) {
      const reviews = storage.getReviewsByRequest(requestId);
      const reviewWithDeliverable = reviews.find((rv: any) => rv.deliverable);
      if (reviewWithDeliverable) {
        storage.updateRequest(requestId, { expertResponse: reviewWithDeliverable.deliverable } as any);
      } else {
        const events = storage.getRequestEventsByRequest(requestId);
        const expertMsgs = events.filter((e: any) => e.type === "message" && e.actorId != null && e.actorId !== r.userId);
        if (expertMsgs.length > 0) {
          const lastExpertMsg = expertMsgs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          storage.updateRequest(requestId, { expertResponse: (lastExpertMsg as any).message || (lastExpertMsg as any).content } as any);
        }
      }
    }

    // Fix 4: Set completedAt timestamp
    storage.updateRequest(requestId, { status: "completed", completedAt: new Date().toISOString() } as any);

    // OB-I: Credit expert on completion (client was already charged on admin verification)
    if (r.expertId) {
      const expert = storage.getExpert(r.expertId);
      if (expert) {
        const expertUser = storage.getUser(expert.userId);
        if (expertUser) {
          const takeRate = TAKE_RATES[(r.priceTier || r.tier || "standard").toLowerCase()] ?? 0.50;
          const earning = Math.max(1, Math.floor(r.creditsCost * (1 - takeRate)));
          const finalizePlatformFee = r.creditsCost - earning;
          storage.updateUser(expertUser.id, { credits: expertUser.credits + earning });
          storage.createTransaction({
            userId: expertUser.id, amount: earning, type: "earning",
            description: `Completed: ${r.title}`,
            takeRatePercent: Math.round(takeRate * 100),
            platformFee: finalizePlatformFee,
            expertPayout: earning,
            clientPaid: r.creditsCost,
          });
          storage.updateExpert(expert.id, { totalReviews: expert.totalReviews + 1 });

          // Fix 9: Update expert averageRating from all client ratings
          try {
            const expertRequests = storage.getRequestsByExpert(expert.id);
            const ratedRequests = expertRequests.filter((er: any) => er.clientRating != null && er.status === "completed");
            if (ratedRequests.length > 0) {
              const avgRating = Math.round(ratedRequests.reduce((sum: number, er: any) => sum + Number(er.clientRating), 0) / ratedRequests.length);
              storage.updateExpert(expert.id, { rating: avgRating });
            }
          } catch (ratingErr) {
            console.error("[FIX-9] Rating update error:", ratingErr);
          }

          // OB-I: Also update wallet balance for expert
          const earningCents = earning * 100;
          const freshExpertUser = storage.getUser(expertUser.id);
          storage.updateUser(expertUser.id, { walletBalance: (freshExpertUser?.walletBalance || 0) + earningCents });
          storage.createWalletTransaction({
            userId: expertUser.id,
            amountCents: earningCents,
            type: "earning",
            description: `Earned from completed request: ${r.title}`,
            createdAt: new Date().toISOString(),
            stripePaymentId: null,
          });
          syncCreditTxToCloud({ userId: expertUser.id, amount: earning, type: "earning", description: `Completed: ${r.title}`, takeRatePercent: Math.round(takeRate * 100), platformFee: finalizePlatformFee, expertPayout: earning, clientPaid: r.creditsCost });
          syncExpertToCloud(expert.id);
          syncUserToCloud(expertUser.id);
          writeUserToBigQuery({ id: expertUser.id, name: expertUser.name, email: expertUser.email, role: expertUser.role, company: expertUser.company, credits: expertUser.credits + earning, createdAt: expertUser.createdAt || undefined }).catch(() => {});
        }
      }
    }

    createAndSyncNotification({
      userId: r.userId,
      title: "Request Completed",
      message: `Your request "${r.title}" has been completed and closed.`,
      type: "completed",
      read: 0,
      link: `/dashboard?request=${r.id}`,
      createdAt: new Date().toISOString(),
    });
    notifyUser(r.userId, {
      type: "request_completed",
      title: "Request Completed",
      message: `Your request "${r.title}" is now complete.`,
      requestId,
    });
    logRequestEvent(requestId, "completed");
    triggerBackup();
    syncRequestToCloud(requestId);
    syncUserToCloud(r.userId);
  }

  // Client can mark request as done (manually close after follow-ups)
  app.post("/api/requests/:id/complete", userOrAdminAuth, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      // Verify authUser is the request owner
      const authUser = (req as any).authUser;
      const existing = storage.getRequest(requestId);
      if (!existing) return res.status(404).json({ error: true, message: "Request not found" });
      if (existing && authUser.role !== 'admin' && existing.userId !== authUser.id) {
        return res.status(403).json({ error: true, message: "Only the request owner can complete it", code: "FORBIDDEN" });
      }
      // Fix 8: Prevent double-complete — return 400 if already completed
      if (existing.status === "completed") {
        return res.status(400).json({ error: true, message: "Request is already completed", code: "ALREADY_COMPLETED" });
      }
      if (existing.refunded === 1) {
        return res.status(400).json({ error: true, message: "Cannot complete a refunded request", code: "REFUNDED" });
      }
      await finalizeRequest(requestId);
      const r = storage.getRequest(requestId);
      return res.json(r);
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // ─── Expert Onboarding Routes ───

  app.post("/api/experts/onboarding/profile", userOrAdminAuth, async (req, res) => {
    try {
      const { expertId, education, yearsExperience, categories, bio, expertise } = req.body;
      if (!expertId) return res.status(400).json({ error: true, message: "expertId is required" });
      const expert = storage.getExpert(Number(expertId));
      if (!expert) return res.status(404).json({ error: true, message: "Expert not found" });
      const authUser = (req as any).authUser;
      if (authUser.role !== 'admin' && expert.userId !== authUser.id) return res.status(403).json({ error: true, message: "Forbidden", code: "FORBIDDEN" });
      // Validate categories is an array
      const cats = Array.isArray(categories) ? categories : [];
      // Fix 1: XSS — sanitize expert profile fields
      const updated = storage.updateExpert(Number(expertId), {
        education: sanitizeHtml((education || "").toString().trim()),
        yearsExperience: Math.max(0, parseInt(yearsExperience) || 0),
        categories: JSON.stringify(cats),
        bio: sanitizeHtml((bio || "").toString().trim()),
        expertise: sanitizeHtml((expertise || "").toString().trim()),
        onboardingComplete: Math.max(expert.onboardingComplete, 1),
      });
      if (!updated) return res.status(500).json({ error: true, message: "Failed to update expert profile" });
      syncExpertToCloud(updated.id);
      return res.json(updated);
    } catch (e: any) {
      console.error("[ONBOARDING/PROFILE]", e);
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  app.get("/api/experts/onboarding/assignment", async (req, res) => {
    const category = (req.query.category as string || "").toLowerCase();
    const pool = TEST_ASSIGNMENTS.filter((a) => a.category === category);
    if (pool.length === 0) {
      return res.status(400).json({ error: true, message: "No assignments for category: " + category });
    }
    const assignment = pool[Math.floor(Math.random() * pool.length)];
    return res.json({
      id: assignment.id,
      category: assignment.category,
      title: assignment.title,
      userQuestion: assignment.userQuestion,
      aiAnswer: assignment.aiAnswer,
      instructions: "Review the AI-generated answer below. Identify any errors, omissions, or misleading statements. Provide a corrected or improved version. You have 30 minutes.",
      timeLimit: 30,
    });
  });

  app.post("/api/experts/onboarding/test", userOrAdminAuth, async (req, res) => {
    try {
      const { expertId, assignmentId, category, response } = req.body;
      if (!expertId) return res.status(400).json({ error: true, message: "expertId is required" });
      const expert = storage.getExpert(Number(expertId));
      if (!expert) return res.status(404).json({ error: true, message: "Expert not found" });
      const authUser = (req as any).authUser;
      if (authUser.role !== 'admin' && expert.userId !== authUser.id) return res.status(403).json({ error: true, message: "Forbidden", code: "FORBIDDEN" });

      const responseText = (response || "").toString().trim();
      const passed = responseText.length >= 200;

      storage.createVerificationTest({
        expertId: expert.id,
        category: (category || "").toString(),
        answers: JSON.stringify({ assignmentId: assignmentId || null, response: responseText }),
        score: passed ? 100 : 0,
        passed: passed ? 1 : 0,
      });

      if (passed) {
        storage.updateExpert(expert.id, {
          onboardingComplete: 3,
          verified: 1,
          verificationScore: 100,
          availability: 1,
        });
      }

      return res.json({
        passed,
        score: passed ? 100 : 0,
        message: passed
          ? "Your response has been submitted and reviewed. Welcome to A2A Expert Opinion!"
          : "Your response must be at least 200 characters. Please provide a more detailed review.",
      });
    } catch (e: any) {
      console.error("[ONBOARDING/TEST]", e);
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  // ─── Expert Review Routes ───

  app.get("/api/reviews/request/:requestId/detailed", userOrAdminAuth, async (req, res) => {
    const reviews = storage.getDetailedReviewsByRequest(parseInt(req.params.requestId));
    return res.json(reviews);
  });

  // ─── Helper: synthesize ExpertReview-like objects from the requests table ───
  // The expert_reviews table may be empty if the workflow used /api/requests/:id/claim
  // instead of /api/reviews/:id/claim. This helper ensures the expert dashboard still
  // shows data by generating review objects from the requests table.
  function synthesizeReviewFromRequest(r: any): any {
    // Map request status to review-like status
    let reviewStatus = r.status;
    if (r.status === "awaiting_followup" || r.status === "completed") {
      reviewStatus = "completed";
    } else if (r.status === "in_progress" || r.status === "under_review") {
      reviewStatus = "in_progress";
    } else if (r.status === "pending") {
      reviewStatus = "pending";
    }
    return {
      id: r.id,          // use request ID as the review ID
      requestId: r.id,
      expertId: r.expertId ?? null,
      status: reviewStatus,
      rating: r.clientRating ?? null,
      ratingComment: r.clientRatingComment ?? null,
      correctPoints: null,
      incorrectPoints: null,
      suggestions: null,
      deliverable: r.expertResponse ?? null,
      createdAt: r.createdAt,
      completedAt: (reviewStatus === "completed") ? (r.updatedAt || r.createdAt) : null,
      invoiced: 0,
      updatedAt: r.updatedAt || r.createdAt,
    };
  }

  app.get("/api/reviews/request/:requestId", userOrAdminAuth, async (req, res) => {
    let reviews = storage.getReviewsByRequest(parseInt(req.params.requestId));
    // Fallback: synthesize from the request itself if no expert_reviews exist
    if (reviews.length === 0) {
      const request = storage.getRequest(parseInt(req.params.requestId));
      if (request && request.expertId) {
        reviews = [synthesizeReviewFromRequest(request)] as any;
      }
    }
    return res.json(reviews);
  });

  app.get("/api/reviews/expert/:expertId", userOrAdminAuth, async (req, res) => {
    let reviews = storage.getReviewsByExpert(parseInt(req.params.expertId));
    // Fallback: synthesize from requests assigned to this expert
    if (reviews.length === 0) {
      const expertRequests = storage.getRequestsByExpert(parseInt(req.params.expertId));
      reviews = expertRequests
        .filter((r: any) => r.status !== "pending") // only show claimed/active/completed
        .map((r: any) => synthesizeReviewFromRequest(r)) as any;
    }
    return res.json(reviews);
  });

  app.get("/api/reviews/pending", userOrAdminAuth, async (req, res) => {
    let reviews = storage.getPendingReviews();
    // Fallback: synthesize from pending requests if no expert_reviews exist
    if (reviews.length === 0) {
      const pendingRequests = storage.getPendingRequests();
      reviews = pendingRequests.map((r: any) => synthesizeReviewFromRequest(r)) as any;
    }
    // Expert matching: filter by expert's categories if expertId is provided
    const expertId = req.query.expertId ? parseInt(req.query.expertId as string) : null;
    if (expertId) {
      const expert = storage.getExpert(expertId);
      if (expert) {
        let expertCats: string[] = [];
        try { expertCats = JSON.parse(expert.categories || "[]"); } catch {}
        if (expertCats.length > 0) {
          reviews = reviews.filter((rev) => {
            const request = storage.getRequest(rev.requestId);
            return request && expertCats.includes(request.category);
          });
        }
      }
    }
    // FIX-3: Attach expertPayout to each review (after take rate)
    const reviewsWithPayout = reviews.map((rev) => {
      const req = storage.getRequest(rev.requestId);
      if (!req) return { ...rev, expertPayout: 0 };
      const tier = (req.priceTier || req.tier || "standard").toLowerCase();
      const takeRate = TAKE_RATES[tier] ?? 0.50;
      const allRevs = storage.getReviewsByRequest(rev.requestId);
      const perReviewCost = req.creditsCost / Math.max(allRevs.length || 1, 1);
      const expertPayout = Math.max(1, Math.floor(perReviewCost * (1 - takeRate)));
      return { ...rev, expertPayout };
    });
    return res.json(reviewsWithPayout);
  });

  app.post("/api/reviews/:id/claim", userOrAdminAuth, async (req, res) => {
    const authUser = (req as any).authUser;
    if (authUser.role !== 'admin' && authUser.role !== 'expert') {
      return res.status(403).json({ error: true, message: "Only experts can claim reviews", code: "FORBIDDEN" });
    }
    const { expertId } = req.body;
    let review = storage.getExpertReview(parseInt(req.params.id));

    // Fallback: if no expert_review exists, the ID is actually a request ID
    // (from synthesized reviews). Create a real expert_review + update the request.
    if (!review) {
      const request = storage.getRequest(parseInt(req.params.id));
      if (!request) return res.status(404).json({ error: true, message: "Review not found" });
      if (request.status !== "pending") return res.status(400).json({ error: true, message: "Request already claimed" });

      // Create the expert_review record
      const newReview = storage.createExpertReview({
        requestId: request.id,
        expertId,
        status: "in_progress",
      });
      // Update the request
      storage.updateRequest(request.id, { expertId, status: "in_progress" });

      // Log + notify
      const expert = expertId ? storage.getExpert(expertId) : null;
      const expertUser = expert ? storage.getUser(expert.userId) : null;
      logRequestEvent(request.id, "claimed", expertUser?.id, expertUser?.name || "Expert");
      createAndSyncNotification({
        userId: request.userId,
        title: "Expert Claimed Your Request",
        message: `An expert has started reviewing "${request.title}".`,
        type: "claim",
        read: 0,
        link: `/dashboard?request=${request.id}`,
        createdAt: new Date().toISOString(),
      });
      notifyUser(request.userId, {
        type: "claimed",
        title: "Expert Claimed Your Request",
        message: `${expertUser?.name || "An expert"} is now reviewing "${request.title}"`,
        requestId: request.id,
      });
      syncRequestToCloud(request.id);
      triggerBackup();
      return res.json(newReview);
    }

    if (review.status !== "pending") return res.status(400).json({ error: true, message: "Review already claimed" });

    const updated = storage.updateExpertReview(review.id, {
      expertId, status: "in_progress",
    });

    // Also update the parent request: set expertId and status to in_progress
    const request = storage.getRequest(review.requestId);
    if (request && request.status === "pending") {
      storage.updateRequest(review.requestId, { expertId, status: "in_progress" });
    }

    // Log timeline event + notify
    const expert = expertId ? storage.getExpert(expertId) : null;
    const expertUser = expert ? storage.getUser(expert.userId) : null;
    logRequestEvent(review.requestId, "claimed", expertUser?.id, expertUser?.name || "Expert");
    if (request) {
      createAndSyncNotification({
        userId: request.userId,
        title: "Expert Claimed Your Request",
        message: `An expert has started reviewing "${request.title}".`,
        type: "claim",
        read: 0,
        link: `/dashboard?request=${request.id}`,
        createdAt: new Date().toISOString(),
      });
      // SSE push to client
      notifyUser(request.userId, {
        type: "claimed",
        title: "Expert Claimed Your Request",
        message: `${expertUser?.name || "An expert"} is now reviewing "${request.title}"`,
        requestId: request.id,
      });
    }

    return res.json(updated);
  });

  app.patch("/api/reviews/:id", userOrAdminAuth, async (req, res) => {
    const authUser = (req as any).authUser;
    let review = storage.getExpertReview(parseInt(req.params.id));
    // Fallback: if no expert_review exists, the ID is a request ID (synthesized review)
    if (!review) {
      const request = storage.getRequest(parseInt(req.params.id));
      if (!request || !request.expertId) return res.status(404).json({ error: true, message: "Review not found" });
      review = storage.createExpertReview({
        requestId: request.id,
        expertId: request.expertId,
        status: "in_progress",
      });
    }

    // Verify authUser is the review's expert
    if (authUser.role !== 'admin' && review.expertId) {
      const exp = storage.getExpert(review.expertId);
      if (!exp || exp.userId !== authUser.id) return res.status(403).json({ error: true, message: "Forbidden", code: "FORBIDDEN" });
    }

    const { rating, ratingComment, correctPoints, incorrectPoints, suggestions, deliverable } = req.body;

    const updated = storage.updateExpertReview(review.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      ...(rating !== undefined && { rating }),
      ...(ratingComment !== undefined && { ratingComment }),
      ...(correctPoints !== undefined && { correctPoints }),
      ...(incorrectPoints !== undefined && { incorrectPoints }),
      ...(suggestions !== undefined && { suggestions }),
      ...(deliverable !== undefined && { deliverable }),
    });

    if (updated) {
      const allReviews = storage.getReviewsByRequest(review.requestId);
      const allCompleted = allReviews.every((r) => r.status === "completed");
      if (allCompleted) {
        storage.updateRequest(review.requestId, { status: "completed" });
        // FEAT-011: Mark held credits as charged when all reviews are completed
        const completedRequest = storage.getRequest(review.requestId);
        if (completedRequest) {
          const chargeTakeRate = TAKE_RATES[(completedRequest.priceTier || completedRequest.tier || "standard").toLowerCase()] ?? 0.50;
          const chargeExpertPayout = Math.max(1, Math.floor(completedRequest.creditsCost * (1 - chargeTakeRate)));
          const chargePlatformFee = completedRequest.creditsCost - chargeExpertPayout;
          storage.createTransaction({
            userId: completedRequest.userId, amount: completedRequest.creditsCost, type: "charged",
            description: `Credits charged for completed request: ${completedRequest.title}`,
            takeRatePercent: Math.round(chargeTakeRate * 100),
            platformFee: chargePlatformFee,
            expertPayout: chargeExpertPayout,
            clientPaid: completedRequest.creditsCost,
          });
        }
      }

      // Credit the expert
      if (updated.expertId) {
        const expert = storage.getExpert(updated.expertId);
        if (expert) {
          const user = storage.getUser(expert.userId);
          const request = storage.getRequest(review.requestId);
          if (user && request) {
            // FIX-1: Consistent tier-based take rate
            const takeRate = TAKE_RATES[(request.priceTier || request.tier || "standard").toLowerCase()] ?? 0.50;
            const perReviewCost = request.creditsCost / allReviews.length;
            const earning = Math.max(1, Math.floor(perReviewCost * (1 - takeRate)));
            const reviewPlatformFee = Math.round(perReviewCost) - earning;
            storage.updateUser(user.id, { credits: user.credits + earning });
            storage.createTransaction({
              userId: user.id, amount: earning, type: "earning",
              description: `Completed review: ${request.title}`,
              takeRatePercent: Math.round(takeRate * 100),
              platformFee: reviewPlatformFee,
              expertPayout: earning,
              clientPaid: Math.round(perReviewCost),
            });
            storage.updateExpert(expert.id, { totalReviews: expert.totalReviews + 1 });

            // Add wallet earnings too
            const earningCents = earning * 100;
            storage.updateUser(user.id, { walletBalance: (storage.getUser(user.id)?.walletBalance || 0) + earningCents });
            storage.createWalletTransaction({
              userId: user.id,
              amountCents: earningCents,
              type: "earning",
              description: `Earned from review: ${request.title}`,
              createdAt: new Date().toISOString(),
              stripePaymentId: null,
            });
          }
        }
      }

      // Log timeline event
      if (updated.expertId) {
        const completedExpert = storage.getExpert(updated.expertId);
        const completedExpertUser = completedExpert ? storage.getUser(completedExpert.userId) : null;
        logRequestEvent(review.requestId, "completed", completedExpertUser?.id, completedExpertUser?.name || "Expert");
      }

      // Notify client if all reviews completed
      const request = storage.getRequest(review.requestId);
      if (request) {
        createAndSyncNotification({
          userId: request.userId,
          title: "Expert Review Submitted",
          message: `An expert has submitted their review for "${request.title}".`,
          type: "review_submitted",
          read: 0,
          link: `/dashboard?request=${request.id}`,
          createdAt: new Date().toISOString(),
        });
        // SSE push to client
        notifyUser(request.userId, {
          type: "review_completed",
          title: "Review Completed!",
          message: `An expert submitted their review for "${request.title}"`,
          requestId: request.id,
        } as any);
      }
    }

    // FIX-7: Trigger backup after expert review submission
    triggerBackup();
    return res.json(updated);
  });

  // POST /api/expert-reviews/:reviewId/respond — expert submits deliverable → goes to admin review queue
  app.post("/api/expert-reviews/:reviewId/respond", userOrAdminAuth, async (req, res) => {
    try {
      const reviewId = parseInt(req.params.reviewId);
      const { deliverable } = req.body;
      if (!deliverable?.trim()) {
        return res.status(400).json({ error: true, message: "deliverable is required" });
      }

      let review = storage.getExpertReview(reviewId);
      // Fallback: if no expert_review exists, the ID is a request ID (from synthesized reviews).
      // Create a real expert_review from the request and proceed.
      if (!review) {
        const request = storage.getRequest(reviewId);
        if (!request || !request.expertId) return res.status(404).json({ error: true, message: "Review not found" });
        review = storage.createExpertReview({
          requestId: request.id,
          expertId: request.expertId,
          status: "in_progress",
        });
      }
      if (review.status === "completed") {
        return res.status(400).json({ error: true, message: "Review already completed" });
      }
      // Verify authUser is the review's expert
      const authUser = (req as any).authUser;
      if (authUser.role !== 'admin' && review.expertId) {
        const exp = storage.getExpert(review.expertId);
        if (!exp || exp.userId !== authUser.id) return res.status(403).json({ error: true, message: "Forbidden", code: "FORBIDDEN" });
      }

      // Store the deliverable but mark as pending_admin_review (not yet completed)
      const updated = storage.updateExpertReview(reviewId, {
        deliverable,
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      // Mark the REQUEST as under_review (not yet visible to client)
      storage.updateRequest(review.requestId, { status: "under_review" });

      // Log timeline event
      if (updated?.expertId) {
        const submittingExpert = storage.getExpert(updated.expertId);
        const submittingExpertUser = submittingExpert ? storage.getUser(submittingExpert.userId) : null;
        logRequestEvent(review.requestId, "under_review", submittingExpertUser?.id, submittingExpertUser?.name || "Expert", "Response submitted — pending A2A verification");
      }

      // Notify admins via email
      const requestForNotif = storage.getRequest(review.requestId);
      if (requestForNotif && updated?.expertId) {
        const notifExpert = storage.getExpert(updated.expertId);
        const notifExpertUser = notifExpert ? storage.getUser(notifExpert.userId) : null;
        try {
          await sendVerificationEmail(notifExpertUser?.name || "Expert", requestForNotif.title);
        } catch (emailErr) {
          console.error("[VERIFY EMAIL] Failed to send verification email:", emailErr);
        }
      }

      // Trigger backup
      triggerBackup();
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // ─── ADMIN REVIEW QUEUE ───

  // GET /api/admin/pending-reviews — returns all requests with status "under_review"
  app.get("/api/admin/pending-reviews", adminAuth, async (_req, res) => {
    try {
      // FIX-11: Use safeArray to prevent '(t || []).filter is not a function'
      const allRequests = safeArray(storage.getAllRequests());
      const pendingReview = allRequests.filter((r) => r.status === "under_review");
      const allUsers = safeArray(storage.getAllUsers());
      const allExperts = safeArray(storage.getAllExperts());
      const userMap = new Map(allUsers.map((u) => [u.id, u]));
      const expertMap = new Map(allExperts.map((e) => [e.id, e]));

      const enriched = pendingReview.map((r) => {
        const clientUser = userMap.get(r.userId);
        let expertName = "Unknown";
        let expertResponse = "";
        if (r.expertId) {
          const expert = expertMap.get(r.expertId);
          if (expert) {
            const eu = userMap.get(expert.userId);
            expertName = eu?.name || "Unknown";
          }
          // Get the latest completed review for this request
          const reviews = storage.getReviewsByRequest(r.id);
          const completedReview = reviews.find((rev) => rev.status === "completed" && rev.deliverable);
          expertResponse = completedReview?.deliverable || "";
        }
        // BUG-2 fix: Include file attachments for admin review queue
        const fileAttachments = sqlite.prepare(
          "SELECT id, request_id, filename, content_type, size, uploader_id, uploader_role, created_at FROM file_attachments WHERE request_id = ?"
        ).all(r.id) as any[];
        return {
          ...r,
          clientName: clientUser?.name || "Unknown",
          expertName,
          expertResponse,
          fileAttachments: fileAttachments || [],
        };
      });

      return res.json(enriched);
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // POST /api/admin/reviews/:requestId/approve — approve response, send to client
  // OB-I: Charge client on admin approval. Expert credited later on completion.
  app.post("/api/admin/reviews/:requestId/approve", adminAuth, async (req, res) => {
    try {
      const requestId = parseInt(String(req.params.requestId));
      const request = storage.getRequest(requestId);
      if (!request) return res.status(404).json({ error: true, message: "Request not found" });
      if (request.status !== "under_review") {
        return res.status(400).json({ error: true, message: "Request is not under review" });
      }

      const newStatus = "awaiting_followup";
      const followupDeadline = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

      // Bug-1 fix: If expertResponse is null, copy from expert_reviews.deliverable first, then fall back to timeline
      if (!request.expertResponse) {
        const reviews = storage.getReviewsByRequest(requestId);
        const reviewWithDeliverable = reviews.find((rv: any) => rv.deliverable);
        if (reviewWithDeliverable) {
          storage.updateRequest(requestId, { expertResponse: reviewWithDeliverable.deliverable } as any);
        } else {
          const events = storage.getRequestEventsByRequest(requestId);
          const expertMsgs = events.filter((e: any) => e.type === "message" && e.actorId != null && e.actorId !== request.userId);
          if (expertMsgs.length > 0) {
            const lastExpertMsg = expertMsgs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            storage.updateRequest(requestId, { expertResponse: (lastExpertMsg as any).message || (lastExpertMsg as any).content } as any);
          }
        }
      }

      storage.updateRequest(requestId, {
        status: newStatus,
        followup_deadline: followupDeadline,
      } as any);

      // OB-I: Charge client NOW on admin verification (not on completion)
      const clientUser = storage.getUser(request.userId);
      if (clientUser) {
        storage.updateUser(request.userId, { credits: Math.max(0, clientUser.credits - request.creditsCost) });
        const approveTakeRate = TAKE_RATES[(request.priceTier || request.tier || "standard").toLowerCase()] ?? 0.50;
        const approveExpertPayout = Math.max(1, Math.floor(request.creditsCost * (1 - approveTakeRate)));
        const approvePlatformFee = request.creditsCost - approveExpertPayout;
        const approveTakeRatePercent = Math.round(approveTakeRate * 100);
        storage.createTransaction({
          userId: request.userId,
          amount: -request.creditsCost,
          type: "charged",
          description: `Credits charged for verified response: ${request.title}`,
          takeRatePercent: approveTakeRatePercent,
          platformFee: approvePlatformFee,
          expertPayout: approveExpertPayout,
          clientPaid: request.creditsCost,
        });
        syncUserToCloud(request.userId);
        syncCreditTxToCloud({ userId: request.userId, amount: -request.creditsCost, type: "charged", description: `Credits charged: ${request.title}`, takeRatePercent: approveTakeRatePercent, platformFee: approvePlatformFee, expertPayout: approveExpertPayout, clientPaid: request.creditsCost });
        writeUserToBigQuery({ id: clientUser.id, name: clientUser.name, email: clientUser.email, role: clientUser.role, company: clientUser.company, credits: Math.max(0, clientUser.credits - request.creditsCost), createdAt: clientUser.createdAt || undefined }).catch(() => {});
      }

      // Log timeline event
      logRequestEvent(requestId, "approved", undefined, "A2A Admin", "Response approved and delivered to client");

      // Notify client
      createAndSyncNotification({
        userId: request.userId,
        title: "Expert Response Ready",
        message: `Your expert's verified response for "${request.title}" is now available. You may ask up to 2 follow-up questions within 3 hours.`,
        type: "response_ready",
        read: 0,
        link: `/dashboard?request=${request.id}`,
        createdAt: new Date().toISOString(),
      });
      notifyUser(request.userId, {
        type: "review_approved",
        title: "Expert Response Ready",
        message: `Your expert's verified response for "${request.title}" is now available.`,
        requestId: request.id,
      } as any);

      // Send approval emails to cofounders
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY || "re_PrjaSqsY_fdEew3xntXPQsouj46kysKRF");
        await resend.emails.send({
          from: "A2A Global <noreply@a2a.global>",
          to: ["oleg@a2a.global", "amir@a2a.global"],
          subject: `A2A Global — Response Approved for "${request.title}"`,
          html: `<p>The expert response for request <strong>"${request.title}"</strong> has been approved and delivered to the client.</p>`,
        });
      } catch (emailErr) {
        console.error("[APPROVE EMAIL] Failed:", emailErr);
      }

      triggerBackup();
      syncRequestToCloud(requestId);
      return res.json({ ok: true, status: newStatus });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // POST /api/admin/reviews/:requestId/reject — send back to expert for revision
  app.post("/api/admin/reviews/:requestId/reject", adminAuth, async (req, res) => {
    try {
      const requestId = parseInt(String(req.params.requestId));
      const { feedback } = req.body;
      const request = storage.getRequest(requestId);
      if (!request) return res.status(404).json({ error: true, message: "Request not found" });
      if (request.status !== "under_review") {
        return res.status(400).json({ error: true, message: "Request is not under review" });
      }

      // Revert request to in_progress so expert can revise
      storage.updateRequest(requestId, { status: "in_progress" });

      // Revert the completed review back to in_progress
      const allReviews = storage.getReviewsByRequest(requestId);
      for (const rev of allReviews) {
        if (rev.status === "completed") {
          storage.updateExpertReview(rev.id, { status: "in_progress" });
          sqlite.prepare("UPDATE expert_reviews SET completed_at = NULL WHERE id = ?").run(rev.id);
        }
      }

      // Log timeline event
      logRequestEvent(requestId, "revision_requested", undefined, "A2A Admin", feedback || "Revision requested by admin");

      // Notify expert
      if (request.expertId) {
        const expert = storage.getExpert(request.expertId);
        if (expert) {
          const expertUser = storage.getUser(expert.userId);
          if (expertUser) {
            createAndSyncNotification({
              userId: expertUser.id,
              title: "Revision Requested",
              message: `Admin has requested a revision for "${request.title}"${feedback ? ": " + feedback : "."}`,
              type: "revision_requested",
              read: 0,
              link: `/expert?request=${requestId}`,
              createdAt: new Date().toISOString(),
            });
            notifyUser(expertUser.id, {
              type: "revision_requested",
              title: "Revision Requested",
              message: `Please revise your response for "${request.title}".`,
              requestId,
            } as any);
          }
        }
      }

      triggerBackup();
      return res.json({ ok: true, status: "in_progress" });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // ─── Messages / Chat ───

  app.get("/api/messages/:requestId", userOrAdminAuth, async (req, res) => {
    const msgs = storage.getMessagesByRequest(parseInt(req.params.requestId));
    return res.json(msgs);
  });

  app.post("/api/messages", userOrAdminAuth, async (req, res) => {
    // Auth: verify caller is request owner or assigned expert
    const authUser = (req as any).authUser;
    const reqRecord = storage.getRequest(req.body.requestId);
    if (reqRecord && authUser.role !== "admin") {
      const isOwner = reqRecord.userId === authUser.id;
      let isExpert = false;
      if (reqRecord.expertId) { const exp = storage.getExpert(reqRecord.expertId); isExpert = !!exp && exp.userId === authUser.id; }
      if (!isOwner && !isExpert) return res.status(403).json({ error: true, message: "Forbidden", code: "FORBIDDEN" });
    }
    const { requestId, role, content } = req.body;
    // Fix 1: XSS — sanitize message content
    const msg = createAndSyncMessage({ requestId, role, content: sanitizeHtml(content || '') });
    return res.json(msg);
  });

  // AI Chat for requests
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages: chatMessages, message, category } = req.body;
      // Support both { messages: [...] } and { message: "string" } formats
      const msgs = chatMessages || (message ? [{ role: "user", content: message }] : []);
      if (!msgs.length) return res.status(400).json({ error: true, message: "No message provided" });
      const text = await getAIResponse(msgs, category || "finance", 1024);
      return res.json({ content: text });
    } catch (e: any) {
      console.error("Chat error:", e);
      return res.status(500).json({ error: true, message: "AI chat error: " + e.message });
    }
  });

  // Standalone AI chat for landing page Try-It
  app.post("/api/chat/try", async (req, res) => {
    try {
      const { message, category } = req.body;
      const text = await getAIResponse([{ role: "user", content: message }], category || "finance", 512);
      return res.json({ content: text });
    } catch (e: any) {
      console.error("Try-it chat error:", e);
      return res.status(500).json({ error: true, message: "AI chat error: " + e.message });
    }
  });

  // ─── Credits ───

  app.get("/api/credits/:userId", userOrAdminAuth, async (req, res) => {
    if (!ownerOrAdmin(req, res, 'userId')) return;
    const user = storage.getUser(parseInt(req.params.userId));
    if (!user) return res.status(404).json({ error: true, message: "User not found" });
    const transactions = storage.getTransactionsByUser(user.id);
    return res.json({ credits: user.credits, transactions });
  });

  app.post("/api/credits/buy", userOrAdminAuth, async (req, res) => {
    if (!ownerOrAdmin(req, res, 'userId', 'body')) return;
    const { userId, packageId } = req.body;
    // Support both old package names and new credit pack names
    const legacyPackages: Record<string, { credits: number; price: number; name: string }> = {
      standard: { credits: 3, price: 29, name: "Standard" },
      comfort: { credits: 10, price: 79, name: "Comfort" },
      business: { credits: 30, price: 199, name: "Business" },
      elite: { credits: 100, price: 499, name: "Elite" },
    };
    const pkg = legacyPackages[packageId];
    if (!pkg) return res.status(400).json({ error: true, message: "Invalid package" });
    const user = storage.getUser(userId);
    if (!user) return res.status(404).json({ error: true, message: "User not found" });

    storage.updateUser(userId, { credits: user.credits + pkg.credits });
    storage.createTransaction({
      userId, amount: pkg.credits, type: "purchase",
      description: `${pkg.name} package — ${pkg.credits} credits ($${pkg.price})`,
    });
    syncUserToCloud(userId);
    syncCreditTxToCloud({ userId, amount: pkg.credits, type: "purchase", description: `${pkg.name} package` });
    const updatedUser = storage.getUser(userId);
    if (updatedUser) {
      writeUserToBigQuery({ id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, company: updatedUser.company, credits: updatedUser.credits, createdAt: updatedUser.createdAt || undefined }).catch(() => {});
    }
    return res.json({ credits: updatedUser?.credits });
  });

  // ─── Wallet / Stripe ───

  app.post("/api/wallet/create-checkout", userOrAdminAuth, async (req, res) => {
    try {
      const { userId, packId } = req.body;
      const pack = CREDIT_PACKS[packId];
      if (!pack) return res.status(400).json({ error: true, message: "Invalid pack" });
      const user = storage.getUser(userId);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });

      // Sandbox mock: directly add credits (no real Stripe)
      storage.updateUser(userId, { credits: user.credits + pack.credits });
      storage.createTransaction({
        userId, amount: pack.credits, type: "purchase",
        description: `${pack.name} — ${pack.credits} credits`,
      });
      storage.createWalletTransaction({
        userId,
        amountCents: pack.dollars * 100,
        type: "topup",
        description: `Credit pack: ${pack.name}`,
        createdAt: new Date().toISOString(),
        stripePaymentId: `mock_${uuidv4().slice(0, 8)}`,
      });
      syncUserToCloud(userId);
      syncCreditTxToCloud({ userId, amount: pack.credits, type: "purchase", description: `${pack.name}` });

      const updatedUser = storage.getUser(userId);
      if (updatedUser) {
        writeUserToBigQuery({ id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, company: updatedUser.company, credits: updatedUser.credits, createdAt: updatedUser.createdAt || undefined }).catch(() => {});
      }
      return res.json({ success: true, credits: updatedUser?.credits, mock: true });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  app.get("/api/wallet/balance/:userId", userOrAdminAuth, async (req, res) => {
    if (!ownerOrAdmin(req, res, 'userId')) return;
    const user = storage.getUser(parseInt(req.params.userId));
    if (!user) return res.status(404).json({ error: true, message: "User not found" });
    const transactions = storage.getWalletTransactionsByUser(user.id);
    return res.json({ walletBalance: user.walletBalance, transactions });
  });

  app.post("/api/wallet/withdraw", userOrAdminAuth, async (req, res) => {
    try {
      if (!ownerOrAdmin(req, res, 'userId', 'body')) return;
      const { userId, amountCents } = req.body;
      const user = storage.getUser(userId);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });
      if (amountCents < 20000) return res.status(400).json({ error: true, message: "Minimum withdrawal is $200" });
      if (user.walletBalance < amountCents) return res.status(400).json({ error: true, message: "Insufficient wallet balance" });

      const expert = storage.getExpertByUserId(userId);
      storage.updateUser(userId, { walletBalance: user.walletBalance - amountCents });
      storage.createWalletTransaction({
        userId,
        amountCents: -amountCents,
        type: "withdrawal",
        description: `Withdrawal: $${(amountCents / 100).toFixed(2)}`,
        createdAt: new Date().toISOString(),
        stripePaymentId: null,
      });
      storage.createWithdrawal({
        userId,
        expertId: expert?.id || null,
        amountCents,
        status: "pending",
        createdAt: new Date().toISOString(),
        processedAt: null,
      });

      syncUserToCloud(userId);
      return res.json({ message: "Withdrawal submitted", walletBalance: user.walletBalance - amountCents });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // ─── Notifications ───

  app.get("/api/notifications/:userId", userOrAdminAuth, async (req, res) => {
    if (!ownerOrAdmin(req, res, 'userId')) return;
    const notifs = storage.getNotificationsByUser(parseInt(req.params.userId));
    const unreadCount = storage.getUnreadCount(parseInt(req.params.userId));
    return res.json({ notifications: notifs, unreadCount });
  });

  app.patch("/api/notifications/:id/read", userOrAdminAuth, async (req, res) => {
    // Verify authUser owns the notification
    const notif = storage.markNotificationRead(parseInt(req.params.id));
    if (!notif) return res.status(404).json({ error: true, message: "Notification not found" });
    const authUser = (req as any).authUser;
    if (authUser.role !== 'admin' && notif.userId !== authUser.id) {
      return res.status(403).json({ error: true, message: "Forbidden", code: "FORBIDDEN" });
    }
    return res.json(notif);
  });

  // Create a notification — admin only
  app.post("/api/notifications/create", adminAuth, async (req, res) => {
    try {
      const { userId, title, message } = req.body;
      if (!userId || !title || !message) {
        return res.status(400).json({ error: true, message: "Missing fields" });
      }
      const notif = createAndSyncNotification({
        userId, title, message, type: "admin", read: 0, createdAt: new Date().toISOString(),
      });
      return res.json(notif);
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // ─── Settings ───

  app.patch("/api/users/:id", userOrAdminAuth, async (req, res) => {
    if (!ownerOrAdmin(req, res, 'id')) return;
    // Fix 1: XSS — sanitize user-editable string fields
    const sanitized = sanitizeObject(req.body, ['name', 'company', 'bio', 'description']);
    const user = storage.updateUser(parseInt(req.params.id), sanitized);
    if (!user) return res.status(404).json({ error: true, message: "User not found" });
    syncUserToCloud(user.id);
    const { password: _, ...safeUser } = user;
    return res.json(safeUser);
  });

  // ─── Tour Completion ───
  app.post("/api/users/:id/tour-complete", userOrAdminAuth, async (req, res) => {
    if (!ownerOrAdmin(req, res, 'id')) return;
    const user = storage.updateUser(parseInt(req.params.id), { tourCompleted: 1 });
    if (!user) return res.status(404).json({ error: true, message: "User not found" });
    syncUserToCloud(user.id);
    return res.json({ success: true });
  });

  // ─── Profile Photo Upload ───
  app.post("/api/users/:id/photo", userOrAdminAuth, photoUpload.single("photo"), async (req, res) => {
    if (!ownerOrAdmin(req, res, 'id')) return;
    try {
      const userId = parseInt(String(req.params.id));
      const user = storage.getUser(userId);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });
      if (!req.file) return res.status(400).json({ error: true, message: "No photo file provided" });
      // Store as base64 data URI (Cloud Run is ephemeral, so DB storage is safer)
      const base64 = req.file.buffer.toString("base64");
      const dataUri = `data:${req.file.mimetype};base64,${base64}`;
      const updated = storage.updateUser(userId, { photo: dataUri } as any);
      if (!updated) return res.status(500).json({ error: true, message: "Failed to update user" });
      const { password: _, ...safeUser } = updated;
      return res.json(safeUser);
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  // ─── Profile Photo Retrieve ───
  app.get("/api/users/:id/photo", async (req, res) => {
    const user = storage.getUser(parseInt(String(req.params.id)));
    if (!user) return res.status(404).json({ error: true, message: "User not found" });
    const photo = (user as any).photo;
    if (!photo) return res.status(404).json({ error: true, message: "No photo uploaded" });
    // photo is a data URI — parse and return as image
    const matches = photo.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: true, message: "Invalid photo data" });
    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    res.set("Content-Type", mimeType);
    res.set("Cache-Control", "public, max-age=86400");
    return res.send(buffer);
  });

  // ─── File Attachments (DB primary + GCS fallback) ───

  // FIX-5: Upload file — stores in DB as base64 (primary approach, avoids GCS stripping issues)
  app.post("/api/requests/:requestId/upload", userOrAdminAuth, attachmentUpload.single("file"), async (req, res) => {
    try {
      const requestId = parseInt(String(req.params.requestId));
      const file = req.file;
      if (!file) return res.status(400).json({ error: true, message: "No file provided" });

      // Build 39 Fix: Track who uploaded the file
      const uploaderId = (req as any).user?.id || null;
      const uploaderRole = (req as any).user?.role || null;

      const base64Data = file.buffer.toString("base64");
      const now = new Date().toISOString();

      // Store file with uploader tracking in SQLite
      const result = sqlite.prepare(
        "INSERT INTO file_attachments (request_id, filename, content_type, data, size, uploader_id, uploader_role, created_at) VALUES (?,?,?,?,?,?,?,?)"
      ).run(Number(requestId), file.originalname, file.mimetype, base64Data, file.size, uploaderId, uploaderRole, now);

      // Also upload to GCS for redundancy (fire-and-forget)
      const gcsPath = `attachments/${requestId}/${file.originalname}`;
      uploadToGcs(gcsPath, file.buffer, file.mimetype)
        .then(() => {
          // Update gcs_path in SQLite
          sqlite.prepare("UPDATE file_attachments SET gcs_path = ? WHERE id = ?").run(gcsPath, Number(result.lastInsertRowid));
          console.log(`[FILE-GCS] Backed up to gs://a2a-global-data/${gcsPath}`);
        })
        .catch((err) => console.error(`[FILE-GCS] GCS backup failed for ${file.originalname}:`, err.message));

      // Persist metadata to Cloud SQL (no blob data)
      writeFileAttachmentToCloudSql({
        id: Number(result.lastInsertRowid),
        requestId: Number(requestId),
        filename: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        gcsPath: gcsPath,
        createdAt: now,
      }).catch(() => {});

      triggerBackup();
      console.log(`[FILE-DB] Uploaded ${file.originalname} (${file.size} bytes) for request ${requestId} by user ${uploaderId} (${uploaderRole})`);
      return res.json({ ok: true, id: Number(result.lastInsertRowid), filename: file.originalname, size: file.size, uploaderId, uploaderRole });
    } catch (e: any) {
      console.error("[FILE-DB] Upload error:", e.message);
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // FIX-5: Download file — serves from DB
  // BUG-1 fix: Accept ?token=JWT query param so <a href> downloads work (browser links don't send Authorization headers)
  app.get("/api/files/:requestId/:filename", (req, res) => {
    try {
      // Authenticate via Authorization header OR ?token query param
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string | undefined;
      const tokenStr = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : queryToken;
      if (!tokenStr) {
        return res.status(401).json({ error: true, message: "Authentication required" });
      }
      try {
        const decoded = jwt.verify(tokenStr, JWT_SECRET) as any;
        (req as any).authUser = decoded;
      } catch {
        return res.status(401).json({ error: true, message: "Invalid or expired token" });
      }

      const { requestId, filename } = req.params;
      const file = sqlite.prepare(
        "SELECT * FROM file_attachments WHERE request_id = ? AND filename = ?"
      ).get(Number(requestId), decodeURIComponent(filename)) as any;

      if (!file) {
        console.log(`[FILE-DB] Not found: request=${requestId} file=${filename}`);
        return res.status(404).json({ error: true, message: "File not found" });
      }

      const buffer = Buffer.from(file.data, "base64");
      res.setHeader("Content-Type", file.content_type);
      res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
      res.setHeader("Content-Length", buffer.length);
      console.log(`[FILE-DB] Serving ${file.filename} (${buffer.length} bytes)`);
      return res.send(buffer);
    } catch (e: any) {
      console.error("[FILE-DB] Download error:", e.message);
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // FIX-5: List files for a request (Build 39: includes uploader tracking)
  app.get("/api/files/:requestId", userOrAdminAuth, (req, res) => {
    try {
      const files = sqlite.prepare(
        "SELECT id, request_id, filename, content_type, size, uploader_id, uploader_role, created_at FROM file_attachments WHERE request_id = ?"
      ).all(Number(req.params.requestId));
      return res.json(files);
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // POST /api/requests/:requestId/attachments — upload files to GCS (legacy, kept as fallback)
  app.post("/api/requests/:requestId/attachments", userOrAdminAuth, attachmentUpload.array("files"), async (req, res) => {
    try {
      const requestId = parseInt(String(req.params.requestId));
      const request = storage.getRequest(requestId);
      if (!request) return res.status(404).json({ error: true, message: "Request not found" });

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: true, message: "No files provided" });
      }

      // Parse existing attachments
      let existing: Array<{ filename: string; path: string; contentType: string; size: number }> = [];
      try { existing = JSON.parse(request.attachments || "[]"); } catch {}

      const uploaded: Array<{ filename: string; path: string; contentType: string; size: number }> = [];

      for (const file of files) {
        const gcsPath = `attachments/${requestId}/${file.originalname}`;
        try {
          await uploadToGcs(gcsPath, file.buffer, file.mimetype);
          uploaded.push({
            filename: file.originalname,
            path: gcsPath,
            contentType: file.mimetype,
            size: file.size,
          });
        } catch (uploadErr: any) {
          console.error(`[GCS] Failed to upload ${file.originalname}:`, uploadErr.message);
          // Fall through — still add to metadata so client knows what was attempted
          uploaded.push({
            filename: file.originalname,
            path: gcsPath,
            contentType: file.mimetype,
            size: file.size,
          });
        }
      }

      const allAttachments = [...existing, ...uploaded];
      const updated = storage.updateRequest(requestId, { attachments: JSON.stringify(allAttachments) });

      return res.json({ uploaded, attachments: allAttachments, request: updated });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // GET /api/attachments/:requestId/:filename — download file from GCS with DB fallback
  app.get("/api/attachments/:requestId/:filename", userOrAdminAuth, async (req, res) => {
    try {
      const { requestId, filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);

      // FIX-6: Try DB fallback first for legacy {name, content} attachments
      const request = storage.getRequest(parseInt(requestId));
      if (request) {
        let attachments: Array<any> = [];
        try { attachments = JSON.parse(request.attachments || "[]"); } catch {}
        const match = attachments.find((a: any) => a.name === decodedFilename || a.filename === decodedFilename);
        if (match && match.content) {
          // Legacy text-based attachment stored in DB
          res.set("Content-Type", match.contentType || "text/plain");
          res.set("Content-Disposition", `attachment; filename="${decodedFilename}"`);
          return res.send(Buffer.from(match.content, "utf-8"));
        }
      }

      // Try GCS download
      const gcsPath = `attachments/${requestId}/${decodedFilename}`;
      let gcsResponse: any;
      try {
        gcsResponse = await downloadFromGcs(gcsPath);
      } catch (gcsErr: any) {
        console.error(`[GCS] Download failed for ${gcsPath}:`, gcsErr.message);
        return res.status(404).json({ error: true, message: "File not found" });
      }
      if (!gcsResponse.ok) {
        console.error(`[GCS] Download HTTP error ${gcsResponse.status} for ${gcsPath}`);
        return res.status(gcsResponse.status === 404 ? 404 : 500).json({
          error: true,
          message: gcsResponse.status === 404 ? "File not found" : "Failed to download file",
        });
      }
      const contentType = gcsResponse.headers.get("content-type") || "application/octet-stream";
      res.set("Content-Type", contentType);
      res.set("Content-Disposition", `attachment; filename="${decodedFilename}"`);
      // Stream the response body
      const arrayBuffer = await gcsResponse.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (e: any) {
      console.error("[ATTACHMENT] Download error:", e.message);
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // ─── Client Rating ───
  app.post("/api/requests/:id/rate", userOrAdminAuth, async (req, res) => {
    const authUser = (req as any).authUser;
    const existing = storage.getRequest(parseInt(req.params.id));
    if (existing && authUser.role !== "admin" && existing.userId !== authUser.id) return res.status(403).json({ error: true, message: "Forbidden", code: "FORBIDDEN" });
    try {
      const requestId = parseInt(req.params.id);
      const { rating, comment } = req.body;
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: true, message: "Rating must be between 1 and 5" });
      }
      const request = storage.getRequest(requestId);
      if (!request) return res.status(404).json({ error: true, message: "Request not found" });
      if (request.status !== "completed") return res.status(400).json({ error: true, message: "Can only rate completed requests" });
      if (request.clientRating) return res.status(400).json({ error: true, message: "Already rated" });
      const updated = storage.updateRequest(requestId, {
        clientRating: rating,
        clientRatingComment: comment || null,
      });

      // Update the expert's average rating in the experts table
      if (request.expertId) {
        const expert = storage.getExpert(request.expertId);
        if (expert) {
          // Compute new average rating from all completed reviews with client ratings
          const allReqs = storage.getRequestsByExpert(request.expertId);
          const ratedReqs = allReqs.filter(r => r.clientRating !== null && r.clientRating !== undefined);
          // Include the new rating (not yet persisted in the fetched list)
          const totalRatings = ratedReqs.reduce((sum, r) => sum + (r.clientRating || 0), 0) + rating;
          const countRatings = ratedReqs.length + 1;
          // Store as integer 0-50 (where 50 = 5.0 stars, matching existing schema convention)
          const newAvgRating = Math.round((totalRatings / countRatings) * 10);
          storage.updateExpert(request.expertId, { rating: newAvgRating });
          syncExpertToCloud(request.expertId);
        }
      }
      syncRequestToCloud(requestId);

      return res.json(updated);
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  // ─── Client Refund ───
  app.post("/api/requests/:id/refund", adminAuth, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const request = storage.getRequest(requestId);
      if (!request) return res.status(404).json({ error: true, message: "Request not found" });
      if (request.refunded === 1) return res.status(400).json({ error: true, message: "Already refunded" });
      if (!request.clientRating || request.clientRating > 2) {
        return res.status(400).json({ error: true, message: "Refund only available for 1-2 star ratings" });
      }

      const user = storage.getUser(request.userId);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });
      const txs = storage.getTransactionsByUser(user.id);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const refundsThisMonth = txs.filter((t) => t.type === "refund" && t.createdAt >= monthStart).length;
      if (refundsThisMonth >= 2) return res.status(400).json({ error: true, message: "Maximum 2 refunds per month reached" });

      storage.updateRequest(requestId, { refunded: 1 });
      storage.updateUser(user.id, { credits: user.credits + request.creditsCost });
      storage.createTransaction({
        userId: user.id, amount: request.creditsCost, type: "refund",
        description: `Refund: ${request.title}`,
      });

      createAndSyncNotification({
        userId: user.id,
        title: "Refund Processed",
        message: `$${request.creditsCost} credits have been refunded for "${request.title}".`,
        type: "refund",
        read: 0,
        createdAt: new Date().toISOString(),
      });

      syncUserToCloud(user.id);
      syncRequestToCloud(requestId);
      syncCreditTxToCloud({ userId: user.id, amount: request.creditsCost, type: "refund", description: `Refund: ${request.title}` });
      writeUserToBigQuery({ id: user.id, name: user.name, email: user.email, role: user.role, company: user.company, credits: user.credits + request.creditsCost, createdAt: user.createdAt || undefined }).catch(() => {});
      return res.json({ message: "Refund processed", credits: user.credits + request.creditsCost });
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  // ─── Expert Onboarding Rate Step ───
  app.post("/api/experts/onboarding/rate", userOrAdminAuth, async (req, res) => {
    try {
      const { expertId, ratePerMinute, rateTier } = req.body;
      if (!expertId) return res.status(400).json({ error: true, message: "expertId is required" });
      const expert = storage.getExpert(Number(expertId));
      if (!expert) return res.status(404).json({ error: true, message: "Expert not found" });
      const updated = storage.updateExpert(Number(expertId), {
        ratePerMinute: ratePerMinute ? String(ratePerMinute) : "0.50",
        rateTier: rateTier || "pro",
        onboardingComplete: Math.max(expert.onboardingComplete, 2),
      });
      if (!updated) return res.status(500).json({ error: true, message: "Failed to update expert rate" });
      syncExpertToCloud(updated.id);
      return res.json(updated);
    } catch (e: any) {
      console.error("[ONBOARDING/RATE]", e);
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  // ─── Expert Withdrawal (legacy) ───
  app.post("/api/experts/withdraw", userOrAdminAuth, async (req, res) => {
    try {
      const { userId, amount } = req.body;
      const user = storage.getUser(userId);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });
      // BUG-FIX: Withdrawal balance wrong ($4 instead of $54).
      // Calculate balance by summing ALL transaction types (bonus, charged, earning, etc.),
      // not just what's in user.credits which may miss initial bonus credits.
      const allTxResult = sqlite.prepare(
        "SELECT SUM(amount) as total FROM credit_transactions WHERE user_id = ?"
      ).get(userId) as { total: number | null };
      const trueBalance = allTxResult?.total || 0;
      const effectiveBalance = Math.max(user.credits, trueBalance);
      if (effectiveBalance < amount) return res.status(400).json({ error: true, message: "Insufficient balance" });
      // BUG-003 + BUG-4: Enforce $200 minimum withdrawal
      if (amount < 200) return res.status(400).json({ error: true, message: "Minimum withdrawal amount is $200" });

      storage.updateUser(userId, { credits: effectiveBalance - amount });
      storage.createTransaction({
        userId, amount: -amount, type: "withdrawal",
        description: `Withdrawal: ${amount} credits ($${Number(amount).toFixed(2)}) via Bank Transfer`,
      });

      return res.json({ message: "Withdrawal submitted", credits: effectiveBalance - amount });
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  // ─── Invoice Routes ───

  app.get("/api/experts/:expertId/invoice-data", userOrAdminAuth, async (req, res) => {
    try {
      const expertId = parseInt(req.params.expertId);
      const expert = storage.getExpert(expertId);
      if (!expert) return res.status(404).json({ error: true, message: "Expert not found" });

      const user = storage.getUser(expert.userId);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });

      // BUG-002: gracefully handle experts with no completed reviews
      const uninvoicedReviews = storage.getUninvoicedReviewsByExpert(expertId);

      // Build line items from uninvoiced reviews (may be empty for new experts)
      // FIX-2: Use expert net payout (not client price) in each line item
      const lineItems = uninvoicedReviews.map((rev) => {
        const request = storage.getRequest(rev.requestId);
        const clientCost = request?.creditsCost || 1;
        const reqTier = ((request?.priceTier || request?.tier || "standard") as string).toLowerCase();
        const takeRate = TAKE_RATES[reqTier] ?? 0.50;
        const expertNetPayout = Math.max(1, Math.floor(clientCost * (1 - takeRate)));
        return {
          reviewId: rev.id,
          requestId: rev.requestId,
          title: request?.title || "Unknown request",
          serviceType: request?.serviceType || "review",
          category: request?.category || "general",
          creditsCost: expertNetPayout,
          completedAt: rev.completedAt || new Date().toISOString(),
          amountCents: expertNetPayout * 100,
        };
      });

      const totalAmountCents = lineItems.reduce((sum, item) => sum + item.amountCents, 0);
      const platformFeeRate = 0;
      const platformFeeCents = 0;
      const netPayoutCents = totalAmountCents;

      let categories: string[] = [];
      try { categories = JSON.parse(expert.categories || "[]"); } catch {}

      return res.json({
        expert: {
          id: expert.id,
          name: user.name,
          email: user.email,
          category: categories[0] || "general",
          tier: normalizeTier(expert.rateTier),
        },
        userId: user.id,
        lineItems,
        totalAmountCents,
        platformFeeRate,
        platformFeeCents,
        netPayoutCents,
        // BUG-002: include whether balance meets minimum
        meetsMinimum: totalAmountCents >= 20000,
        minimumCents: 20000,
      });
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  app.get("/api/experts/:expertId/invoices", userOrAdminAuth, async (req, res) => {
    const expertId = parseInt(req.params.expertId);
    const invoices = storage.getInvoicesByExpert(expertId);
    return res.json(invoices);
  });

  app.post("/api/experts/:expertId/generate-invoice", userOrAdminAuth, async (req, res) => {
    try {
      const expertId = parseInt(req.params.expertId);
      const expert = storage.getExpert(expertId);
      if (!expert) return res.status(404).json({ error: true, message: "Expert not found" });

      const user = storage.getUser(expert.userId);
      if (!user) return res.status(404).json({ error: true, message: "User not found" });

      // Check for existing unpaid invoice first — allow re-generating
      const existingInvoices = storage.getInvoicesByExpert(expertId);
      const pendingInvoice = existingInvoices.find((inv) => inv.status === "pending");

      if (pendingInvoice) {
        // Return existing pending invoice with its data
        let parsedItems: any[] = [];
        try { parsedItems = JSON.parse(pendingInvoice.lineItems || "[]"); } catch {}
        let categories: string[] = [];
        try { categories = JSON.parse(expert.categories || "[]"); } catch {}
        return res.json({
          invoice: pendingInvoice,
          expert: { id: expert.id, name: user.name, email: user.email, category: categories[0] || "general", tier: normalizeTier(expert.rateTier) },
          lineItems: parsedItems,
          totalAmountCents: pendingInvoice.totalAmount,
          platformFeeRate: 0,
          platformFeeCents: pendingInvoice.platformFee,
          netPayoutCents: pendingInvoice.netPayout,
        });
      }

      const uninvoicedReviews = storage.getUninvoicedReviewsByExpert(expertId);
      if (uninvoicedReviews.length === 0) return res.status(400).json({ error: true, message: "No uninvoiced reviews found. Complete reviews to generate an invoice." });

      // Build line items — FIX-2: use expert net payout amounts, not client price
      const lineItems = uninvoicedReviews.map((rev) => {
        const request = storage.getRequest(rev.requestId);
        const clientCost = request?.creditsCost || 1;
        const reqTier = ((request?.priceTier || request?.tier || "standard") as string).toLowerCase();
        const takeRate = TAKE_RATES[reqTier] ?? 0.50;
        const expertNetPayout = Math.max(1, Math.floor(clientCost * (1 - takeRate)));
        return {
          reviewId: rev.id,
          requestId: rev.requestId,
          title: request?.title || "Unknown request",
          serviceType: request?.serviceType || "review",
          category: request?.category || "general",
          creditsCost: expertNetPayout,
          completedAt: rev.completedAt || new Date().toISOString(),
          amountCents: expertNetPayout * 100,
        };
      });

      const totalAmountCents = lineItems.reduce((sum, item) => sum + item.amountCents, 0);

      // BUG-003 + BUG-4: Enforce $200 minimum withdrawal threshold
      if (totalAmountCents < 20000) {
        return res.status(400).json({
          error: true,
          message: `Minimum withdrawal amount is $200. Your current balance is $${(totalAmountCents / 100).toFixed(2)}.`,
          code: "BELOW_MINIMUM",
          totalAmountCents,
        });
      }

      const platformFeeRate = 0;
      const platformFeeCents = 0;
      const netPayoutCents = totalAmountCents;

      // Generate invoice number: A2AEX-2026-XXXX
      const existingCount = storage.getInvoiceCount();
      const invoiceNumber = `A2AEX-2026-${String(existingCount + 1).padStart(4, "0")}`;

      // Create invoice record
      const invoice = storage.createInvoice({
        expertId,
        invoiceNumber,
        totalAmount: totalAmountCents,
        platformFee: platformFeeCents,
        netPayout: netPayoutCents,
        status: "pending",
        lineItems: JSON.stringify(lineItems),
        createdAt: new Date().toISOString(),
      });

      // Mark reviews as invoiced
      const reviewIds = uninvoicedReviews.map((r) => r.id);
      storage.markReviewsInvoiced(reviewIds);

      // Create a withdrawal record
      storage.createWithdrawal({
        userId: user.id,
        expertId,
        amountCents: netPayoutCents,
        status: "pending",
        createdAt: new Date().toISOString(),
        processedAt: null,
      });

      // Deduct credits from user
      const creditAmount = Math.round(netPayoutCents / 100);
      if (user.credits >= creditAmount) {
        storage.updateUser(user.id, { credits: user.credits - creditAmount });
        storage.createTransaction({
          userId: user.id,
          amount: -creditAmount,
          type: "withdrawal",
          description: `Withdrawal: ${creditAmount} credits — Invoice ${invoiceNumber}`,
        });
      }

      let categories: string[] = [];
      try { categories = JSON.parse(expert.categories || "[]"); } catch {}

      // FIX: Invoice email not sent — send email to expert after invoice generation
      if (user.email) {
        sendInvoiceEmail(user.email, {
          invoiceNumber,
          expertName: user.name,
          netPayoutCents,
          totalAmountCents,
          lineItems: lineItems.map((item) => ({ title: item.title, amountCents: item.amountCents })),
          createdAt: invoice.createdAt,
        }).catch((err: any) => {
          console.error("[INVOICE] Failed to send invoice email:", err?.message);
        });
      }

      return res.json({
        invoice,
        expert: {
          id: expert.id,
          name: user.name,
          email: user.email,
          category: categories[0] || "general",
          tier: normalizeTier(expert.rateTier),
        },
        lineItems,
        totalAmountCents,
        platformFeeRate,
        platformFeeCents,
        netPayoutCents,
      });
    } catch (e: any) {
      return res.status(400).json({ error: true, message: e.message });
    }
  });

  // ─── Seed ───
  app.post("/api/seed", async (_req, res) => {
    try {
      const existing = storage.getUserByUsername("demo_client");
      if (existing) return res.json({ message: "Already seeded" });

      // Create admin
      const adminHash = await bcrypt.hash("A2A2026!", 10);
      storage.createAdmin({
        email: "oleg@a2a.global",
        password: adminHash,
        name: "Oleg (Admin)",
      });

      const pwHash = await bcrypt.hash("password123", 10);

      // Create demo client
      const client = storage.createUser({
        username: "demo_client", password: pwHash,
        name: "Alex Johnson", email: "alex@example.com",
        role: "client", credits: 50, company: "TechCorp", accountType: "individual",
        walletBalance: 5000, active: 1,
      });
      storage.createTransaction({ userId: client.id, amount: 5, type: "bonus", description: "Welcome bonus" });
      storage.createTransaction({ userId: client.id, amount: 45, type: "purchase", description: "Business package — 30 credits ($199)" });
      storage.createWalletTransaction({ userId: client.id, amountCents: 5000, type: "topup", description: "Credit pack: $50 — 60 Credits", createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), stripePaymentId: "mock_abc123" });
      storage.createWalletTransaction({ userId: client.id, amountCents: -1500, type: "spend", description: "Request: Portfolio diversification", createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), stripePaymentId: null });

      // Create demo expert user 1
      const expertUser = storage.createUser({
        username: "demo_expert", password: pwHash,
        name: "Dr. Sarah Chen", email: "sarah@example.com",
        role: "expert", credits: 25, company: "A2A Global", accountType: "individual",
        walletBalance: 15000, active: 1,
      });
      const expert1 = storage.createExpert({
        userId: expertUser.id, bio: "15+ years in financial advisory and wealth management. Former VP at Goldman Sachs.",
        expertise: "Investment Strategy, Tax Planning, Retirement Planning, Portfolio Management",
        credentials: "CFA, CFP, MBA Wharton", rating: 48, totalReviews: 127,
        verified: 1, categories: JSON.stringify(["finance", "business"]),
        availability: 1, hourlyRate: 250, responseTime: "< 12 hours",
        education: "MBA, Wharton School", yearsExperience: 15, onboardingComplete: 3, verificationScore: 100,
        ratePerMinute: "2.50", rateTier: "pro",
      });
      storage.createWalletTransaction({ userId: expertUser.id, amountCents: 15000, type: "earning", description: "Earnings from 12 completed reviews", createdAt: new Date(Date.now() - 7 * 86400000).toISOString(), stripePaymentId: null });

      // Create expert 2
      const expertUser2 = storage.createUser({
        username: "demo_expert2", password: pwHash,
        name: "James Rivera", email: "james@example.com",
        role: "expert", credits: 18, company: null, accountType: "individual",
        walletBalance: 8500, active: 1,
      });
      const expert2 = storage.createExpert({
        userId: expertUser2.id, bio: "Serial entrepreneur with 3 successful exits. Angel investor in 20+ startups.",
        expertise: "Startup Strategy, Fundraising, Product-Market Fit, Growth Hacking",
        credentials: "MBA Stanford, YC Alumni", rating: 47, totalReviews: 89,
        verified: 1, categories: JSON.stringify(["entrepreneurship", "business"]),
        availability: 1, hourlyRate: 200, responseTime: "< 24 hours",
        education: "MBA, Stanford Graduate School of Business", yearsExperience: 10, onboardingComplete: 3, verificationScore: 90,
        ratePerMinute: "1.50", rateTier: "pro",
      });
      storage.createWalletTransaction({ userId: expertUser2.id, amountCents: 8500, type: "earning", description: "Earnings from 8 completed reviews", createdAt: new Date(Date.now() - 4 * 86400000).toISOString(), stripePaymentId: null });

      // Create expert 3
      const expertUser3 = storage.createUser({
        username: "demo_expert3", password: pwHash,
        name: "Maria Lopez", email: "maria@example.com",
        role: "expert", credits: 12, company: "FinTech Advisors", accountType: "individual",
        walletBalance: 22000, active: 1,
      });
      const expert3 = storage.createExpert({
        userId: expertUser3.id, bio: "Tax optimization specialist with 10+ years at Big 4. Expert in international tax structures.",
        expertise: "Tax Planning, International Tax, Corporate Finance, Compliance",
        credentials: "CPA, LLM Tax, CGMA", rating: 46, totalReviews: 65,
        verified: 1, categories: JSON.stringify(["finance"]),
        availability: 1, hourlyRate: 180, responseTime: "< 8 hours",
        education: "LLM in Taxation, NYU School of Law", yearsExperience: 12, onboardingComplete: 3, verificationScore: 95,
        ratePerMinute: "3.00", rateTier: "pro",
      });
      storage.createWalletTransaction({ userId: expertUser3.id, amountCents: 22000, type: "earning", description: "Earnings from 15 completed reviews", createdAt: new Date(Date.now() - 10 * 86400000).toISOString(), stripePaymentId: null });

      // Create new_expert (unverified)
      const newExpertUser = storage.createUser({
        username: "new_expert", password: pwHash,
        name: "Chris Taylor", email: "chris@example.com",
        role: "expert", credits: 5, company: null, accountType: "individual",
        walletBalance: 0, active: 1,
      });
      storage.createExpert({
        userId: newExpertUser.id, bio: "", expertise: "", credentials: "",
        rating: 50, totalReviews: 0, verified: 0, categories: "[]",
        availability: 0, hourlyRate: null, responseTime: null,
        education: "", yearsExperience: 0, onboardingComplete: 0, verificationScore: null,
        ratePerMinute: null, rateTier: null,
      });
      storage.createTransaction({ userId: newExpertUser.id, amount: 5, type: "bonus", description: "Welcome bonus" });

      // Create extra client user
      const client2 = storage.createUser({
        username: "beta_user", password: pwHash,
        name: "Mike Thompson", email: "mike@startup.io",
        role: "client", credits: 15, company: "StartupIO", accountType: "individual",
        walletBalance: 2500, active: 1,
      });
      storage.createTransaction({ userId: client2.id, amount: 5, type: "bonus", description: "Welcome bonus" });
      storage.createTransaction({ userId: client2.id, amount: 10, type: "purchase", description: "Standard package" });

      // ─── Sample Request 1: Rate type (5 experts, 3 responded) ───
      const req1 = storage.createRequest({
        userId: client.id, expertId: null,
        title: "Rate my AI portfolio diversification strategy",
        description: "I asked AI about portfolio diversification for $500K and want multiple experts to rate the quality of its advice.",
        category: "finance", tier: "standard", status: "in_progress",
        creditsCost: 5, expertResponse: null, deadline: null,
        serviceType: "rate",
        aiResponse: "Based on your $500K portfolio currently at 70% US stocks, I recommend:\n\n1. Reduce US equities to 45%\n2. Add 15% international developed markets\n3. Add 10% emerging markets\n4. Add 20% fixed income\n5. Add 10% alternatives\n\nRebalance quarterly when allocations drift >5%.",
        attachments: JSON.stringify([{ name: "current_portfolio.txt", content: "Current holdings:\n- VTI: 35%\n- AAPL: 15%\n- MSFT: 10%\n- AMZN: 10%\n- Cash: 30%" }]),
        expertsNeeded: 5,
        instructions: "Please rate the AI's diversification advice on a scale of 1-10.",
        llmProvider: "groq", llmModel: "Llama 3.3 70B",
        pricePerMinute: "0.50", priceTier: "pro",
        clientRating: null, clientRatingComment: null, refunded: 0,
      });
      storage.createExpertReview({ requestId: req1.id, expertId: expert1.id, status: "completed", rating: 8, ratingComment: "Solid diversification strategy. Well-balanced allocation percentages.", correctPoints: null, incorrectPoints: null, suggestions: null, deliverable: null, completedAt: new Date(Date.now() - 2 * 86400000).toISOString() });
      storage.createExpertReview({ requestId: req1.id, expertId: expert2.id, status: "completed", rating: 7, ratingComment: "Good overall framework. 10% emerging markets might be aggressive for moderate risk.", correctPoints: null, incorrectPoints: null, suggestions: null, deliverable: null, completedAt: new Date(Date.now() - 1 * 86400000).toISOString() });
      storage.createExpertReview({ requestId: req1.id, expertId: expert3.id, status: "completed", rating: 9, ratingComment: "Excellent advice. Quarterly rebalancing at 5% drift is professional-grade.", correctPoints: null, incorrectPoints: null, suggestions: null, deliverable: null, completedAt: new Date().toISOString() });
      storage.createExpertReview({ requestId: req1.id, expertId: null, status: "pending", rating: null, ratingComment: null, correctPoints: null, incorrectPoints: null, suggestions: null, deliverable: null, completedAt: null });
      storage.createExpertReview({ requestId: req1.id, expertId: null, status: "pending", rating: null, ratingComment: null, correctPoints: null, incorrectPoints: null, suggestions: null, deliverable: null, completedAt: null });

      // ─── Sample Request 2: Review type (completed) ───
      const req2 = storage.createRequest({
        userId: client.id, expertId: expert1.id,
        title: "Review AI's SaaS pricing analysis",
        description: "Got AI advice on pricing strategy for our B2B SaaS HR tool. Need a detailed expert review.",
        category: "business", tier: "comfort", status: "completed",
        creditsCost: 3, expertResponse: null, deadline: null,
        serviceType: "review",
        aiResponse: "For your B2B SaaS HR tool, I recommend a hybrid pricing model: Base per-seat pricing $15/user/month, usage tiers, add-on modules, annual discount 20%.",
        attachments: JSON.stringify([{ name: "competitor_analysis.txt", content: "Competitors:\n- BambooHR: $8/user/mo\n- Gusto: $6/user/mo + $40 base\n- Rippling: $8/user/mo" }]),
        expertsNeeded: 1,
        instructions: "Please provide a thorough review of this pricing strategy.",
        llmProvider: "groq", llmModel: "Llama 3.3 70B",
        pricePerMinute: "1.00", priceTier: "standard",
        clientRating: 5, clientRatingComment: "Excellent, thorough review with actionable insights!",
        refunded: 0,
      });
      storage.createExpertReview({
        requestId: req2.id, expertId: expert1.id, status: "completed",
        rating: null, ratingComment: null,
        correctPoints: "• Hybrid pricing model is the right approach\n• Per-seat pricing at $15/user is within market range\n• Annual discount of 20% is industry standard",
        incorrectPoints: "• Missing free trial strategy\n• No usage-based pricing mention\n• Implementation fee range too low",
        suggestions: "1. Add 14-day free trial\n2. Include 'Growth' tier\n3. Raise implementation fees",
        deliverable: null,
        completedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      });

      // ─── Sample Request 3: Custom type (in progress) ───
      const req3 = storage.createRequest({
        userId: client.id, expertId: expert2.id,
        title: "Build a financial model for Series A fundraise",
        description: "Need an expert to build a complete financial model for our Series A.",
        category: "entrepreneurship", tier: "business", status: "in_progress",
        creditsCost: 5, expertResponse: null, deadline: null,
        serviceType: "custom",
        aiResponse: null,
        attachments: JSON.stringify([
          { name: "metrics.txt", content: "MRR: $80K, Growth: 15% m/m, Team: 12" },
        ]),
        expertsNeeded: 1,
        instructions: "Build a complete 18-month financial model with revenue projections.",
        llmProvider: null, llmModel: null,
        pricePerMinute: "5.00", priceTier: "authority",
        clientRating: null, clientRatingComment: null, refunded: 0,
      });
      storage.createExpertReview({ requestId: req3.id, expertId: expert2.id, status: "in_progress", rating: null, ratingComment: null, correctPoints: null, incorrectPoints: null, suggestions: null, deliverable: null, completedAt: null });

      // ─── Sample Request 4: Pending ───
      const req4 = storage.createRequest({
        userId: client.id, expertId: null,
        title: "Rate AI tax optimization advice for freelancers",
        description: "I asked AI about tax strategies for my $150K freelance income.",
        category: "finance", tier: "standard", status: "pending",
        creditsCost: 3, expertResponse: null, deadline: null,
        serviceType: "rate",
        aiResponse: "For $150K freelance income: 1. S-Corp election 2. Solo 401(k) 3. SEP IRA 4. Home office deduction 5. Health insurance deduction 6. Quarterly estimated payments",
        attachments: "[]",
        expertsNeeded: 3,
        instructions: "Rate the accuracy and completeness of this tax advice.",
        llmProvider: "groq", llmModel: "Llama 3.3 70B",
        pricePerMinute: "0.25", priceTier: "intermediate",
        clientRating: null, clientRatingComment: null, refunded: 0,
      });
      storage.createExpertReview({ requestId: req4.id, expertId: null, status: "pending", rating: null, ratingComment: null, correctPoints: null, incorrectPoints: null, suggestions: null, deliverable: null, completedAt: null });
      storage.createExpertReview({ requestId: req4.id, expertId: null, status: "pending", rating: null, ratingComment: null, correctPoints: null, incorrectPoints: null, suggestions: null, deliverable: null, completedAt: null });
      storage.createExpertReview({ requestId: req4.id, expertId: null, status: "pending", rating: null, ratingComment: null, correctPoints: null, incorrectPoints: null, suggestions: null, deliverable: null, completedAt: null });

      // ─── Sample Timeline Events ───
      // Request 1: submitted -> viewed -> claimed (x3) -> completed (x3)
      storage.createRequestEvent({ requestId: req1.id, type: "submitted", actorId: client.id, actorName: "Alex Johnson", message: null, createdAt: new Date(Date.now() - 5 * 86400000).toISOString() });
      storage.createRequestEvent({ requestId: req1.id, type: "claimed", actorId: expertUser.id, actorName: "Dr. Sarah Chen", message: null, createdAt: new Date(Date.now() - 4.9 * 86400000).toISOString() });
      storage.createRequestEvent({ requestId: req1.id, type: "claimed", actorId: expertUser2.id, actorName: "James Rivera", message: null, createdAt: new Date(Date.now() - 4.5 * 86400000).toISOString() });
      storage.createRequestEvent({ requestId: req1.id, type: "claimed", actorId: expertUser3.id, actorName: "Maria Lopez", message: null, createdAt: new Date(Date.now() - 4 * 86400000).toISOString() });
      storage.createRequestEvent({ requestId: req1.id, type: "completed", actorId: expertUser.id, actorName: "Dr. Sarah Chen", message: null, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() });
      storage.createRequestEvent({ requestId: req1.id, type: "completed", actorId: expertUser2.id, actorName: "James Rivera", message: null, createdAt: new Date(Date.now() - 1 * 86400000).toISOString() });
      storage.createRequestEvent({ requestId: req1.id, type: "completed", actorId: expertUser3.id, actorName: "Maria Lopez", message: null, createdAt: new Date().toISOString() });
      storage.createRequestEvent({ requestId: req1.id, type: "message", actorId: client.id, actorName: "Alex Johnson", message: "Can you focus on the emerging market allocation?", createdAt: new Date(Date.now() - 3 * 86400000).toISOString() });
      storage.createRequestEvent({ requestId: req1.id, type: "message", actorId: expertUser.id, actorName: "Dr. Sarah Chen", message: "Sure, I'll add a dedicated section for EM analysis.", createdAt: new Date(Date.now() - 2.8 * 86400000).toISOString() });

      // Request 2: submitted -> claimed -> completed
      storage.createRequestEvent({ requestId: req2.id, type: "submitted", actorId: client.id, actorName: "Alex Johnson", message: null, createdAt: new Date(Date.now() - 7 * 86400000).toISOString() });
      storage.createRequestEvent({ requestId: req2.id, type: "claimed", actorId: expertUser.id, actorName: "Dr. Sarah Chen", message: null, createdAt: new Date(Date.now() - 6.5 * 86400000).toISOString() });
      storage.createRequestEvent({ requestId: req2.id, type: "completed", actorId: expertUser.id, actorName: "Dr. Sarah Chen", message: null, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() });

      // Request 3: submitted -> claimed -> in_review
      storage.createRequestEvent({ requestId: req3.id, type: "submitted", actorId: client.id, actorName: "Alex Johnson", message: null, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() });
      storage.createRequestEvent({ requestId: req3.id, type: "claimed", actorId: expertUser2.id, actorName: "James Rivera", message: null, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() });
      storage.createRequestEvent({ requestId: req3.id, type: "in_review", actorId: expertUser2.id, actorName: "James Rivera", message: null, createdAt: new Date(Date.now() - 1 * 86400000).toISOString() });

      // Request 4: submitted (pending)
      storage.createRequestEvent({ requestId: req4.id, type: "submitted", actorId: client.id, actorName: "Alex Johnson", message: null, createdAt: new Date(Date.now() - 1 * 86400000).toISOString() });

      // ─── Sample Notifications ───
      createAndSyncNotification({ userId: client.id, title: "Welcome to A2A Expert Opinion!", message: "You've received 5 free credits to get started.", read: 1, createdAt: new Date(Date.now() - 7 * 86400000).toISOString() });
      createAndSyncNotification({ userId: client.id, title: "Expert Claimed Your Request", message: 'Dr. Sarah Chen has started working on "Rate my AI portfolio diversification strategy".', read: 1, link: `/dashboard?request=${req1.id}`, createdAt: new Date(Date.now() - 5 * 86400000).toISOString() });
      createAndSyncNotification({ userId: client.id, title: "Expert Review Submitted", message: 'An expert submitted their review for "Review AI\'s SaaS pricing analysis".', read: 0, link: `/dashboard?request=${req2.id}`, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() });
      createAndSyncNotification({ userId: client.id, title: "New Expert Review", message: 'James Rivera rated your portfolio strategy 7/10.', read: 0, link: `/dashboard?request=${req1.id}`, createdAt: new Date(Date.now() - 1 * 86400000).toISOString() });

      createAndSyncNotification({ userId: expertUser.id, title: "New Request Available", message: 'A new rate request "Rate AI tax optimization advice" in finance is available.', read: 0, link: `/expert?view=queue`, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() });
      createAndSyncNotification({ userId: expertUser2.id, title: "New Request Available", message: 'A new custom request "Build a financial model" in entrepreneurship is available.', read: 1, link: `/expert?view=queue`, createdAt: new Date(Date.now() - 4 * 86400000).toISOString() });

      // ─── Sample Withdrawal ───
      storage.createWithdrawal({ userId: expertUser3.id, expertId: expert3.id, amountCents: 10000, status: "pending", createdAt: new Date(Date.now() - 1 * 86400000).toISOString(), processedAt: null });
      storage.createWithdrawal({ userId: expertUser.id, expertId: expert1.id, amountCents: 5000, status: "approved", createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), processedAt: new Date(Date.now() - 3 * 86400000).toISOString() });

      return res.json({ message: "Seeded successfully" });
    } catch (e: any) {
      console.error("Seed error:", e);
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // ===== RL CORE & BUSINESS INTELLIGENCE =====

  app.get("/api/admin/rl-metrics", adminAuth, async (_req, res) => {
    try {
      const allUsers = storage.getAllUsers();
      const allExperts = storage.getAllExperts();
      const allRequests = storage.getAllRequests();
      
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // User metrics
      const totalUsers = allUsers.length;
      const totalExperts = allExperts.length;
      const totalClients = allUsers.filter(u => u.role === "client").length;
      
      // Engagement metrics
      const totalRequests = allRequests.length;
      const completedRequests = allRequests.filter(r => r.status === "completed").length;
      const activeRequests = allRequests.filter(r => r.status === "in_review" || r.status === "pending").length;
      
      // RL Core signals
      const reviewedRequests = allRequests.filter(r => r.status === "completed");
      const avgRating = allExperts.length > 0 ? Math.round(allExperts.reduce((s, e) => s + (e.rating || 50), 0) / allExperts.length) : 0;
      
      // Expert tier distribution
      const standardExperts = allExperts.filter(e => e.rateTier === "standard" || !e.rateTier).length;
      const proExperts = allExperts.filter(e => e.rateTier === "pro").length;
      const guruExperts = allExperts.filter(e => e.rateTier === "guru").length;

      // Revenue metrics (from credit transactions)
      const allTransactions = storage.getAllTransactions();
      const purchases = allTransactions.filter(t => t.type === "purchase");
      const totalRevenue = purchases.reduce((s, t) => s + Math.abs(t.amount), 0);
      
      // CAC calculation (simplified: total marketing spend / total users)
      // Since we don't track marketing spend yet, estimate from credits given as bonuses
      const bonuses = allTransactions.filter(t => t.type === "bonus");
      const totalBonusCost = bonuses.reduce((s, t) => s + t.amount, 0) * 2; // $2 per credit cost estimate
      const cac = totalUsers > 0 ? Math.round(totalBonusCost / totalUsers) : 0;

      // Conversion funnel
      const registeredUsers = totalUsers;
      const verifiedExperts = allExperts.filter(e => e.verified).length;
      const activeExperts = allExperts.filter(e => e.rating > 50).length; // had at least one review
      const paidClients = Array.from(new Set(purchases.map(t => t.userId))).length;
      
      // Daily registrations (last 30 days)
      const dailyRegs: Record<string, { experts: number; clients: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        dailyRegs[key] = { experts: 0, clients: 0 };
      }
      // We don't have createdAt on users in this schema, so use ID-based approximation
      
      // Expert domain distribution
      const domainCounts: Record<string, number> = {};
      allExperts.forEach(e => {
        const domains = (e.expertise || "").split(",").map((d: string) => d.trim()).filter(Boolean);
        domains.forEach(d => { domainCounts[d] = (domainCounts[d] || 0) + 1; });
      });

      // A/B test results (simulated framework)
      const abTests = [
        { 
          name: "Registration CTA", 
          variant_a: "Get Started Free", variant_b: "Join as Expert",
          a_conversions: Math.floor(totalExperts * 0.4), b_conversions: Math.floor(totalExperts * 0.6),
          a_visitors: Math.floor(totalUsers * 1.5), b_visitors: Math.floor(totalUsers * 1.5),
          status: "running", started: "2026-04-09"
        },
        {
          name: "Expert Onboarding Flow",
          variant_a: "3-step wizard", variant_b: "Single page",
          a_conversions: Math.floor(totalExperts * 0.45), b_conversions: Math.floor(totalExperts * 0.55),
          a_visitors: Math.floor(totalExperts * 2), b_visitors: Math.floor(totalExperts * 2),
          status: "running", started: "2026-04-09"
        },
        {
          name: "Pricing Display",
          variant_a: "Per-credit pricing", variant_b: "Hourly rate display",
          a_conversions: paidClients, b_conversions: Math.floor(paidClients * 1.1),
          a_visitors: totalClients || 1, b_visitors: totalClients || 1,
          status: "running", started: "2026-04-09"
        },
      ];

      // LTV calculation
      const avgRevenuePerClient = paidClients > 0 ? Math.round(totalRevenue / paidClients) : 0;
      const estimatedLTV = avgRevenuePerClient * 12; // annualized
      const ltvCacRatio = cac > 0 ? (estimatedLTV / cac).toFixed(1) : "N/A";

      res.json({
        // RL Core
        rlCore: {
          totalTrainingSignals: completedRequests,
          avgExpertRating: avgRating,
          matchAccuracy: completedRequests > 0 ? Math.round((reviewedRequests.length / Math.max(totalRequests, 1)) * 100) : 0,
          errorTaxonomySize: completedRequests * 3, // ~3 error types per review
          modelVersion: "v0.1-pre-training",
          dataPointsCollected: completedRequests * 5,
        },
        // Business metrics
        business: {
          totalUsers, totalExperts, totalClients,
          totalRequests, completedRequests, activeRequests,
          totalRevenue,
          cac,
          ltv: estimatedLTV,
          ltvCacRatio,
          avgRevenuePerClient,
        },
        // Expert tiers
        tiers: { standard: standardExperts, pro: proExperts, guru: guruExperts },
        // Domains
        domains: Object.entries(domainCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        // Conversion funnel
        funnel: [
          { stage: "Registered", count: registeredUsers },
          { stage: "Expert Verified", count: verifiedExperts },
          { stage: "Active Expert", count: activeExperts },
          { stage: "Paid Client", count: paidClients },
          { stage: "Completed Task", count: completedRequests },
        ],
        // A/B tests
        abTests,
        // Legal compliance
        legal: {
          termsAcceptances: sqlite.prepare("SELECT COUNT(*) as c FROM legal_acceptances WHERE document_type='terms_of_use'").get() as any,
          privacyAcceptances: sqlite.prepare("SELECT COUNT(*) as c FROM legal_acceptances WHERE document_type='privacy_policy'").get() as any,
          recentAcceptances: sqlite.prepare("SELECT * FROM legal_acceptances ORDER BY accepted_at DESC LIMIT 10").all(),
        },
      });
    } catch (err: any) {
      console.error("[RL-METRICS]", err);
      res.json({ error: err.message });
    }
  });

  // ─── ADMIN ACQUISITION ANALYTICS ───

  app.get("/api/admin/acquisition", adminAuth, (req, res) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30*24*60*60*1000).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7*24*60*60*1000).toISOString();

      // Total registrations by source
      const bySource = sqlite.prepare(`
        SELECT utm_source, utm_medium, utm_campaign, COUNT(*) as count
        FROM registration_sources
        GROUP BY utm_source, utm_medium, utm_campaign
        ORDER BY count DESC
      `).all();

      // Registrations from news section
      const fromNews = sqlite.prepare(`
        SELECT COUNT(*) as count FROM registration_sources
        WHERE landing_page LIKE '%/news%' OR utm_campaign LIKE '%news%'
      `).get() as any;

      // Daily registrations (last 30 days)
      const dailyRegs = sqlite.prepare(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM registration_sources
        WHERE created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY date
      `).all(thirtyDaysAgo);

      // Page views by path (last 7 days)
      const topPages = sqlite.prepare(`
        SELECT path, COUNT(*) as views
        FROM page_views
        WHERE created_at >= ?
        GROUP BY path
        ORDER BY views DESC
        LIMIT 20
      `).all(sevenDaysAgo);

      // News section views
      const newsViews = sqlite.prepare(`
        SELECT COUNT(*) as count FROM page_views
        WHERE path LIKE '%/news%' AND created_at >= ?
      `).get(thirtyDaysAgo) as any;

      // Conversion funnel: views → registrations
      const totalViews30d = (sqlite.prepare(`
        SELECT COUNT(*) as count FROM page_views WHERE created_at >= ?
      `).get(thirtyDaysAgo) as any)?.count || 0;

      const totalRegs30d = (sqlite.prepare(`
        SELECT COUNT(*) as count FROM registration_sources WHERE created_at >= ?
      `).get(thirtyDaysAgo) as any)?.count || 0;

      // By role
      const expertRegs = sqlite.prepare(`
        SELECT COUNT(*) as count FROM users WHERE role='expert'
      `).get() as any;
      const clientRegs = sqlite.prepare(`
        SELECT COUNT(*) as count FROM users WHERE role='client'
      `).get() as any;

      // Traffic sources breakdown
      const organicCount = (sqlite.prepare(`
        SELECT COUNT(*) as count FROM registration_sources
        WHERE (utm_source IS NULL OR utm_source = '') AND (referrer IS NULL OR referrer = '' OR referrer LIKE '%a2a.global%')
      `).get() as any)?.count || 0;

      const referralCount = (sqlite.prepare(`
        SELECT COUNT(*) as count FROM registration_sources
        WHERE referrer IS NOT NULL AND referrer != '' AND referrer NOT LIKE '%a2a.global%' AND (utm_source IS NULL OR utm_source = '')
      `).get() as any)?.count || 0;

      const paidCount = (sqlite.prepare(`
        SELECT COUNT(*) as count FROM registration_sources
        WHERE utm_medium IN ('cpc', 'ppc', 'paid', 'ad', 'ads')
      `).get() as any)?.count || 0;

      const newsCount = fromNews?.count || 0;

      res.json({
        summary: {
          totalExperts: expertRegs?.count || 0,
          totalClients: clientRegs?.count || 0,
          totalViews30d,
          totalRegs30d,
          conversionRate: totalViews30d > 0 ? ((totalRegs30d / totalViews30d) * 100).toFixed(2) + '%' : '0%',
          fromNews: newsCount,
        },
        trafficSources: {
          organic: organicCount,
          referral: referralCount,
          paid: paidCount,
          news: newsCount,
          direct: Math.max(0, totalRegs30d - organicCount - referralCount - paidCount - newsCount),
        },
        // FIX-11: safeArray on all array fields to prevent .filter errors in admin UI
        bySource: safeArray(bySource),
        dailyRegistrations: safeArray(dailyRegs),
        topPages: safeArray(topPages),
        newsViews: newsViews?.count || 0,
      });
    } catch (err: any) {
      console.error("[ACQUISITION]", err);
      res.json({ error: err.message });
    }
  });

  // ─── Auto-complete requests past their follow-up deadline ───
  // Runs every 5 minutes. Finalizes any awaiting_followup request whose deadline has passed.
  setInterval(async () => {
    try {
      const overdueRequests = sqlite.prepare(
        "SELECT id FROM requests WHERE status = 'awaiting_followup' AND followup_deadline IS NOT NULL AND followup_deadline < ?"
      ).all(new Date().toISOString()) as Array<{ id: number }>;

      for (const row of overdueRequests) {
        console.log(`[AUTO-COMPLETE] Finalizing overdue request #${row.id}`);
        await finalizeRequest(row.id);
      }
    } catch (err: any) {
      console.error("[AUTO-COMPLETE] Error:", err.message);
    }
  }, 5 * 60 * 1000); // every 5 minutes

  // GET /api/admin/send-user-report — trigger on-demand full user data email
  app.get("/api/admin/send-user-report", adminAuth, async (_req, res) => {
    try {
      const allUsers = storage.getAllUsers();
      const allExperts = storage.getAllExperts();
      await sendFullUserDataEmail(allUsers, allExperts);
      res.json({ ok: true, message: `Report sent with ${allUsers.length} users` });
    } catch (err: any) {
      res.json({ ok: false, error: err.message });
    }
  });

  // ─── OB-J: EXPERT VERIFICATION & WITHDRAWAL CYCLE ───

  // Upload passport file for expert verification
  // Build 39 Fix 5: Persist passport/ID file in SQLite + GCS, not just return data URL
  app.post("/api/experts/:expertId/upload-passport", userOrAdminAuth, attachmentUpload.single("passport"), async (req, res) => {
    try {
      const expertId = parseInt(req.params.expertId);
      if (!req.file) return res.status(400).json({ error: true, message: "Passport file is required" });

      const base64 = req.file.buffer.toString("base64");
      const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

      // Persist to SQLite expert_passport_files table
      const now = new Date().toISOString();
      sqlite.prepare(`
        CREATE TABLE IF NOT EXISTS expert_passport_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expert_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          content_type TEXT NOT NULL,
          data TEXT NOT NULL,
          size INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `).run();

      // Upsert: delete old and insert new
      sqlite.prepare("DELETE FROM expert_passport_files WHERE expert_id = ?").run(expertId);
      sqlite.prepare(
        "INSERT INTO expert_passport_files (expert_id, filename, content_type, data, size, created_at, updated_at) VALUES (?,?,?,?,?,?,?)"
      ).run(expertId, req.file.originalname, req.file.mimetype, base64, req.file.size, now, now);

      // Also try GCS upload (fire-and-forget)
      const gcsPath = `expert-passports/${expertId}/${req.file.originalname}`;
      uploadToGcs(gcsPath, req.file.buffer, req.file.mimetype)
        .then(() => console.log(`[PASSPORT] Uploaded to GCS: ${gcsPath}`))
        .catch((err) => console.log(`[PASSPORT] GCS upload skipped: ${err.message}`));

      // Build 39 Fix: Sync passport metadata to Cloud SQL
      const passportRow = sqlite.prepare("SELECT id FROM expert_passport_files WHERE expert_id = ? ORDER BY id DESC LIMIT 1").get(expertId) as any;
      if (passportRow) {
        writeExpertPassportToCloudSql({
          id: passportRow.id,
          expertId,
          filename: req.file.originalname,
          contentType: req.file.mimetype,
          size: req.file.size,
          gcsPath,
          createdAt: now,
        }).catch(() => {});
      }

      triggerBackup();
      console.log(`[PASSPORT] Stored passport for expert ${expertId}: ${req.file.originalname} (${req.file.size} bytes)`);
      return res.json({ url: dataUrl, filename: req.file.originalname });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // Build 39 Fix 5b: Serve passport file from DB
  // FIX-5a: Accept ?token=JWT query param so <img src> and downloadFile() both work
  app.get("/api/experts/:expertId/passport-file", (req, res) => {
    try {
      // Authenticate via Authorization header OR ?token query param
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string | undefined;
      const tokenStr = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : queryToken;
      if (!tokenStr) return res.status(401).json({ error: true, message: "Authentication required" });
      try { jwt.verify(tokenStr, JWT_SECRET); } catch { return res.status(401).json({ error: true, message: "Invalid or expired token" }); }

      const expertId = parseInt(req.params.expertId);
      // Try expert_passport_files table first
      sqlite.prepare(`
        CREATE TABLE IF NOT EXISTS expert_passport_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expert_id INTEGER NOT NULL, filename TEXT NOT NULL,
          content_type TEXT NOT NULL, data TEXT NOT NULL,
          size INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        )
      `).run();
      const file = sqlite.prepare(
        "SELECT * FROM expert_passport_files WHERE expert_id = ? ORDER BY id DESC LIMIT 1"
      ).get(expertId) as any;

      if (file) {
        const buffer = Buffer.from(file.data, "base64");
        res.setHeader("Content-Type", file.content_type);
        res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
        res.setHeader("Content-Length", buffer.length);
        return res.send(buffer);
      }

      // Fallback: check expert_verifications.passportFileUrl for inline data URL
      const verification = storage.getExpertVerificationByExpert(expertId);
      if (verification?.passportFileUrl?.startsWith("data:")) {
        const match = verification.passportFileUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const buffer = Buffer.from(match[2], "base64");
          res.setHeader("Content-Type", match[1]);
          res.setHeader("Content-Disposition", `inline; filename="passport.${match[1].split('/')[1] || 'bin'}"`);
          res.setHeader("Content-Length", buffer.length);
          return res.send(buffer);
        }
      }

      return res.status(404).json({ error: true, message: "No passport file found" });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // Build 39 Fix 5c: Check if expert has passport file
  app.get("/api/experts/:expertId/has-passport", userOrAdminAuth, (req, res) => {
    try {
      const expertId = parseInt(req.params.expertId);
      sqlite.prepare(`
        CREATE TABLE IF NOT EXISTS expert_passport_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expert_id INTEGER NOT NULL, filename TEXT NOT NULL,
          content_type TEXT NOT NULL, data TEXT NOT NULL,
          size INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        )
      `).run();
      const file = sqlite.prepare(
        "SELECT id, filename, content_type, size, created_at FROM expert_passport_files WHERE expert_id = ? ORDER BY id DESC LIMIT 1"
      ).get(expertId) as any;

      if (file) {
        return res.json({ hasPassport: true, filename: file.filename, contentType: file.content_type, size: file.size, uploadedAt: file.created_at });
      }

      // Check inline data URL in expert_verifications
      const verification = storage.getExpertVerificationByExpert(expertId);
      if (verification?.passportFileUrl) {
        return res.json({ hasPassport: true, filename: "passport", contentType: "image/jpeg", size: 0, uploadedAt: verification.createdAt });
      }

      return res.json({ hasPassport: false });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // Submit expert bank/verification details
  app.post("/api/experts/:expertId/verification", userOrAdminAuth, async (req, res) => {
    try {
      const expertId = parseInt(req.params.expertId);
      const expert = storage.getExpert(expertId);
      if (!expert) return res.status(404).json({ error: true, message: "Expert not found" });
      const expertUser = storage.getUser(expert.userId);

      const { passportFileUrl, accountNumber, swiftCode, bankName, bankAddress,
        governmentIdType, governmentIdNumber, fullLegalName, country, fullAddress,
        apartmentStreet, city, stateProvince, postalCode,
        accountHolderName, bankCountry, iban, routingNumber, sortCode, ifscCode } = req.body;
      if (!accountNumber || !swiftCode || !bankName) {
        return res.status(400).json({ error: true, message: "Bank details are required" });
      }

      const existing = storage.getExpertVerificationByExpert(expertId);
      const now = new Date().toISOString();
      let verification;
      const verificationData = {
        passportFileUrl: passportFileUrl || (existing?.passportFileUrl ?? null),
        governmentIdType: governmentIdType || null,
        governmentIdNumber: governmentIdNumber || null,
        fullLegalName: fullLegalName || null,
        country: country || null,
        fullAddress: fullAddress || null,
        apartmentStreet: apartmentStreet || null,
        city: city || null,
        stateProvince: stateProvince || null,
        postalCode: postalCode || null,
        accountNumber, swiftCode, bankName,
        bankAddress: bankAddress || null,
        accountHolderName: accountHolderName || null,
        bankCountry: bankCountry || null,
        iban: iban || null,
        routingNumber: routingNumber || null,
        sortCode: sortCode || null,
        ifscCode: ifscCode || null,
        updatedAt: now,
      };
      if (existing) {
        verification = storage.updateExpertVerification(existing.id, verificationData);
      } else {
        verification = storage.createExpertVerification({
          expertId,
          ...verificationData,
          verifiedByAdmin: 0,
          createdAt: now,
        });
      }

      writeExpertVerificationToCloudSql(verification).catch(() => {});

      // OB-K: Email notification to cofounders — BUG-3a: include all new fields + passport image
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY || "re_PrjaSqsY_fdEew3xntXPQsouj46kysKRF");

        // Build address string from new granular fields
        const addressParts = [apartmentStreet, city, stateProvince, postalCode, country].filter(Boolean);
        const fullAddressDisplay = addressParts.length > 0 ? addressParts.join(", ") : (fullAddress || "Not provided");

        // Build the passport/ID image section for the email body
        let passportSection = "";
        const savedPassportUrl = passportFileUrl || (existing?.passportFileUrl ?? null);
        if (savedPassportUrl && savedPassportUrl.startsWith("data:")) {
          // Inline data URL — embed directly in email
          passportSection = `
            <h3 style="color:#0F3DD1;margin-top:24px;">Government-issued ID Document</h3>
            <img src="${savedPassportUrl}" alt="Expert ID Document" style="max-width:100%;border:1px solid #ddd;border-radius:8px;margin:8px 0;" />
          `;
        } else if (savedPassportUrl) {
          passportSection = `
            <h3 style="color:#0F3DD1;margin-top:24px;">Government-issued ID Document</h3>
            <img src="${savedPassportUrl}" alt="Expert ID Document" style="max-width:100%;border:1px solid #ddd;border-radius:8px;margin:8px 0;" />
          `;
        } else {
          // Check for file stored in expert_passport_files table
          try {
            const passportFile = sqlite.prepare(
              "SELECT filename, content_type FROM expert_passport_files WHERE expert_id = ? ORDER BY id DESC LIMIT 1"
            ).get(expertId) as any;
            if (passportFile) {
              passportSection = `
                <h3 style="color:#0F3DD1;margin-top:24px;">Government-issued ID Document</h3>
                <p style="color:#333;">Document uploaded: <strong>${passportFile.filename}</strong> (${passportFile.content_type})</p>
                <p style="color:#666;font-size:12px;">View and download in the Admin Panel → Withdrawals → Expert ID / Bank Verification</p>
              `;
            }
          } catch (_) { /* ignore */ }
        }

        const emailRow = (label: string, value: string | null | undefined) =>
          value ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#333;width:40%;">${label}</td><td style="padding:8px;border-bottom:1px solid #eee;color:#111;">${value}</td></tr>` : "";

        // FIX-5b: Build email attachments array with the actual ID file
        const emailAttachments: Array<{ filename: string; content: Buffer }> = [];
        try {
          const passportDbFile = sqlite.prepare(
            "SELECT filename, data, content_type FROM expert_passport_files WHERE expert_id = ? ORDER BY id DESC LIMIT 1"
          ).get(expertId) as any;
          if (passportDbFile?.data) {
            emailAttachments.push({
              filename: passportDbFile.filename || "expert-id-document.pdf",
              content: Buffer.from(passportDbFile.data, "base64"),
            });
          }
        } catch (_) {}
        // If no DB file, try base64 data URL
        if (emailAttachments.length === 0 && savedPassportUrl && savedPassportUrl.startsWith("data:")) {
          try {
            const base64Data = savedPassportUrl.split(",")[1];
            const mimeMatch = savedPassportUrl.match(/data:([^;]+)/);
            const ext = mimeMatch ? mimeMatch[1].split("/")[1] : "png";
            emailAttachments.push({
              filename: `expert-id-document.${ext}`,
              content: Buffer.from(base64Data, "base64"),
            });
          } catch (_) {}
        }

        await resend.emails.send({
          from: "A2A Global <noreply@a2a.global>",
          to: ["oleg@a2a.global", "amir@a2a.global"],
          subject: `Verification data for Expert ${expertUser?.name || "Unknown"} uploaded`,
          attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff;">
            <div style="text-align:center;padding:15px;border-bottom:2px solid #0F3DD1;">
              <img src="https://a2a.global/a2a-blue-logo.svg" alt="A2A Global" height="36" />
            </div>
            <h2 style="color:#0F3DD1;margin-top:20px;">Expert Verification Details Uploaded</h2>
            <p style="color:#333;">Expert <strong>${expertUser?.name || "Unknown"}</strong> (${expertUser?.email || ""}) has uploaded their verification and bank details.</p>

            <h3 style="color:#0F3DD1;margin-top:20px;margin-bottom:8px;">Personal Details</h3>
            <table style="width:100%;border-collapse:collapse;margin:0 0 15px 0;">
              ${emailRow("Full Legal Name", fullLegalName)}
              ${emailRow("ID Type", governmentIdType)}
              ${emailRow("Country", country)}
            </table>

            <h3 style="color:#0F3DD1;margin-top:16px;margin-bottom:8px;">Recipient Address</h3>
            <table style="width:100%;border-collapse:collapse;margin:0 0 15px 0;">
              ${emailRow("Apartment / Street", apartmentStreet)}
              ${emailRow("City", city)}
              ${emailRow("State / Province", stateProvince)}
              ${emailRow("Postal / Zip Code", postalCode)}
              ${emailRow("Full Address", !apartmentStreet && fullAddress ? fullAddress : null)}
            </table>

            <h3 style="color:#0F3DD1;margin-top:16px;margin-bottom:8px;">Bank Details</h3>
            <table style="width:100%;border-collapse:collapse;margin:0 0 15px 0;">
              ${emailRow("Bank Name", bankName)}
              ${emailRow("SWIFT / BIC", swiftCode)}
              ${emailRow("Account Number", accountNumber)}
              ${emailRow("Account Holder", accountHolderName)}
              ${emailRow("IBAN", iban)}
              ${emailRow("Routing Number", routingNumber)}
              ${emailRow("Sort Code", sortCode)}
              ${emailRow("IFSC Code", ifscCode)}
              ${emailRow("Bank Country", bankCountry)}
              ${emailRow("Bank Address", bankAddress)}
            </table>

            ${passportSection}

            <div style="margin:24px 0;">
              <a href="https://a2a.global/#/admin/login" style="background:#0F3DD1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Open Admin Panel</a>
            </div>
          </div>`,
        });
      } catch (emailErr) {
        console.error("[VERIFICATION EMAIL] Failed:", emailErr);
      }

      triggerBackup();
      return res.json(verification);
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // Get expert verification details
  app.get("/api/experts/:expertId/verification", userOrAdminAuth, async (req, res) => {
    const expertId = parseInt(req.params.expertId);
    const verification = storage.getExpertVerificationByExpert(expertId);
    return res.json(verification || null);
  });

  // Submit withdrawal request
  app.post("/api/experts/:expertId/withdrawal-request", userOrAdminAuth, async (req, res) => {
    try {
      const expertId = parseInt(req.params.expertId);
      const expert = storage.getExpert(expertId);
      if (!expert) return res.status(404).json({ error: true, message: "Expert not found" });
      const expertUser = storage.getUser(expert.userId);

      // Check if bank details exist
      const verification = storage.getExpertVerificationByExpert(expertId);
      if (!verification || !verification.accountNumber) {
        return res.status(400).json({ error: true, message: "Please upload your verification details first" });
      }

      const { amount } = req.body;
      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: true, message: "Invalid withdrawal amount" });
      }
      // BUG-4: Enforce $200 minimum withdrawal
      if (parseFloat(amount) < 200) {
        return res.status(400).json({ error: true, message: "Minimum withdrawal amount is $200" });
      }

      // Fix 7: Prevent duplicate withdrawals — check for existing pending withdrawal
      const existingWRs = storage.getWithdrawalRequestsByExpert(expertId);
      const pendingWR = existingWRs.find((wr: any) => wr.status === "pending");
      if (pendingWR) {
        return res.status(400).json({ error: true, message: `You already have a pending withdrawal request (Invoice ${pendingWR.invoiceNumber}). Please wait for it to be processed.`, code: "DUPLICATE_WITHDRAWAL" });
      }

      // Generate invoice number
      const allWR = storage.getAllWithdrawalRequests();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(allWR.length + 1).padStart(4, "0")}`;

      const now = new Date().toISOString();
      const wr = storage.createWithdrawalRequest({
        expertId,
        amount: String(amount),
        invoiceNumber,
        status: "pending",
        adminNotes: null,
        createdAt: now,
        updatedAt: now,
      });

      writeWithdrawalRequestToCloudSql(wr).catch(() => {});

      // OB-K: Email to cofounders
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY || "re_PrjaSqsY_fdEew3xntXPQsouj46kysKRF");
        await resend.emails.send({
          from: "A2A Global <noreply@a2a.global>",
          to: ["oleg@a2a.global", "amir@a2a.global"],
          subject: `Withdrawal for ${expertUser?.name || "Unknown"} Expert Requested – Invoice # ${invoiceNumber}`,
          html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
            <div style="text-align:center;padding:15px;border-bottom:2px solid #0F3DD1;">
              <img src="https://a2a.global/a2a-blue-logo.svg" alt="A2A Global" height="36" />
            </div>
            <h2 style="color:#0F3DD1;margin-top:20px;">Withdrawal Request</h2>
            <p>Expert <strong>${expertUser?.name || "Unknown"}</strong> has requested a withdrawal.</p>
            <table style="width:100%;border-collapse:collapse;margin:15px 0;">
              <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Amount</td><td style="padding:8px;border-bottom:1px solid #eee;">$${amount}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Invoice #</td><td style="padding:8px;border-bottom:1px solid #eee;">${invoiceNumber}</td></tr>
            </table>
            <div style="margin:24px 0;">
              <a href="https://a2a.global/#/admin/login" style="background:#0F3DD1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Open Admin Panel</a>
            </div>
          </div>`,
        });
      } catch (emailErr) {
        console.error("[WITHDRAWAL EMAIL] Failed:", emailErr);
      }

      triggerBackup();
      return res.json(wr);
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // Get withdrawal requests for expert
  app.get("/api/experts/:expertId/withdrawal-requests", userOrAdminAuth, async (req, res) => {
    const expertId = parseInt(req.params.expertId);
    return res.json(storage.getWithdrawalRequestsByExpert(expertId));
  });

  // Admin: Get all expert verifications
  app.get("/api/admin/expert-verifications", adminAuth, async (_req, res) => {
    const verifications = storage.getAllExpertVerifications();
    const allExperts = storage.getAllExperts();
    const allUsers = storage.getAllUsers();
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    const expertMap = new Map(allExperts.map(e => [e.id, e]));
    return res.json(verifications.map(v => ({
      ...v,
      expertName: userMap.get(expertMap.get(v.expertId)?.userId || 0)?.name || "Unknown",
      expertEmail: userMap.get(expertMap.get(v.expertId)?.userId || 0)?.email || "",
    })));
  });

  // Admin: Get all withdrawal requests
  app.get("/api/admin/withdrawal-requests", adminAuth, async (_req, res) => {
    const wrs = storage.getAllWithdrawalRequests();
    const allExperts = storage.getAllExperts();
    const allUsers = storage.getAllUsers();
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    const expertMap = new Map(allExperts.map(e => [e.id, e]));
    return res.json(wrs.map(w => ({
      ...w,
      expertName: userMap.get(expertMap.get(w.expertId)?.userId || 0)?.name || "Unknown",
      expertEmail: userMap.get(expertMap.get(w.expertId)?.userId || 0)?.email || "",
      verification: storage.getExpertVerificationByExpert(w.expertId),
    })));
  });

  // Admin: Mark payout as initiated
  app.post("/api/admin/withdrawal-requests/:id/payout", adminAuth, async (req, res) => {
    try {
      const wrId = parseInt(req.params.id);
      const wr = storage.updateWithdrawalRequest(wrId, {
        status: "payout_initiated",
        updatedAt: new Date().toISOString(),
      });
      if (!wr) return res.status(404).json({ error: true, message: "Withdrawal request not found" });

      writeWithdrawalRequestToCloudSql(wr).catch(() => {});

      // G2-7: Deduct payout amount from expert's wallet balance
      const expert = storage.getExpert(wr.expertId);
      const expertUser = expert ? storage.getUser(expert.userId) : null;
      if (expertUser) {
        const payoutCents = Math.round(Number(wr.amount) * 100);
        const payoutCredits = Number(wr.amount); // credits are in dollars, not cents
        const newBalance = Math.max(0, (expertUser.walletBalance || 0) - payoutCents);
        const newCredits = Math.max(0, (expertUser.credits || 0) - payoutCredits);
        storage.updateUser(expertUser.id, { walletBalance: newBalance, credits: newCredits });
        storage.createWalletTransaction({
          userId: expertUser.id,
          amountCents: -payoutCents,
          type: "payout",
          description: `Payout initiated: Invoice ${wr.invoiceNumber}`,
          createdAt: new Date().toISOString(),
          stripePaymentId: null,
        });
        // FIX-1: Also record in credit_transactions so it appears in expert transaction history
        storage.createTransaction({
          userId: expertUser.id,
          amount: -payoutCredits,
          type: "payout",
          description: `Payout initiated: Invoice ${wr.invoiceNumber}`,
        });
        writeUserToCloudSql({ id: expertUser.id, name: expertUser.name, email: expertUser.email, role: expertUser.role, company: expertUser.company, credits: newCredits, walletBalance: newBalance }).catch(() => {});
        writeUserToBigQuery({ id: expertUser.id, name: expertUser.name, email: expertUser.email, role: expertUser.role, company: expertUser.company, credits: newCredits, createdAt: expertUser.createdAt || undefined }).catch(() => {});

        createAndSyncNotification({
          userId: expertUser.id,
          title: "Payout Initiated",
          message: `Your withdrawal of $${wr.amount} (Invoice ${wr.invoiceNumber}) has been initiated. Please allow up to 3 business days.`,
          type: "payout",
          read: 0,
          link: `/expert`,
          createdAt: new Date().toISOString(),
        });

        // OB-K: Email to expert
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY || "re_PrjaSqsY_fdEew3xntXPQsouj46kysKRF");
          await resend.emails.send({
            from: "A2A Global <noreply@a2a.global>",
            to: expertUser.email,
            subject: "Payout Initiated",
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
              <div style="text-align:center;padding:15px;border-bottom:2px solid #0F3DD1;">
                <img src="https://a2a.global/a2a-blue-logo.svg" alt="A2A Global" height="36" />
              </div>
              <h2 style="color:#0F3DD1;margin-top:20px;">Payout Initiated</h2>
              <p>Hi ${expertUser.name},</p>
              <p>Your requested payout of <strong>$${wr.amount}</strong> (Invoice ${wr.invoiceNumber}) is initiated. Please allow up to 3 business days for the funds to arrive into your bank account.</p>
              <p style="color:#6b7280;font-size:13px;">If you have any questions, please contact us at support@a2a.global.</p>
            </div>`,
          });
        } catch (emailErr) {
          console.error("[PAYOUT EMAIL] Failed:", emailErr);
        }
      }

      triggerBackup();
      return res.json(wr);
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // G2-6: Admin endpoint to fetch invoice data by invoice number (for PDF generation)
  app.get("/api/admin/invoices/:invoiceNumber", adminAuth, async (req, res) => {
    try {
      const invoiceNumber = req.params.invoiceNumber;
      const inv = storage.getInvoiceByNumber(invoiceNumber);
      if (inv) {
        // Found in invoices table (credit-based withdrawal flow)
        const expert = storage.getExpert(inv.expertId);
        const user = expert ? storage.getUser(expert.userId) : null;
        let categories: string[] = [];
        try { categories = JSON.parse(expert?.categories || "[]"); } catch {}
        let parsedItems: any[] = [];
        try { parsedItems = JSON.parse(inv.lineItems || "[]"); } catch {}
        return res.json({
          invoice: inv,
          expert: { id: expert?.id, name: user?.name || "Unknown", email: user?.email || "", category: categories[0] || "general", tier: normalizeTier(expert?.rateTier) },
          lineItems: parsedItems,
          totalAmountCents: inv.totalAmount,
          platformFeeRate: 0,
          platformFeeCents: inv.platformFee,
          netPayoutCents: inv.netPayout,
        });
      }

      // BUG-5: Fallback — look up from withdrawal_requests table (new expert payout flow)
      const allWRs = storage.getAllWithdrawalRequests();
      const wr = allWRs.find((w: any) => w.invoiceNumber === invoiceNumber);
      if (wr) {
        const expert = storage.getExpert(wr.expertId);
        const user = expert ? storage.getUser(expert.userId) : null;
        const verification = storage.getExpertVerificationByExpert(wr.expertId);
        let categories: string[] = [];
        try { categories = JSON.parse(expert?.categories || "[]"); } catch {}
        const amountCents = Math.round(parseFloat(wr.amount) * 100);
        return res.json({
          invoice: { invoiceNumber: wr.invoiceNumber, createdAt: wr.createdAt, expertId: wr.expertId, status: wr.status },
          expert: { id: expert?.id, name: verification?.fullLegalName || user?.name || "Unknown", email: user?.email || "", category: categories[0] || "general", tier: normalizeTier(expert?.rateTier) },
          lineItems: [{ title: "Expert Payout", serviceType: "Bank Transfer", completedAt: wr.createdAt, creditsCost: parseFloat(wr.amount), amountCents }],
          totalAmountCents: amountCents,
          platformFeeRate: 0,
          platformFeeCents: 0,
          netPayoutCents: amountCents,
        });
      }

      return res.status(404).json({ error: true, message: "Invoice not found" });
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // Admin: Verify expert bank details
  app.post("/api/admin/expert-verifications/:id/verify", adminAuth, async (req, res) => {
    try {
      const vId = parseInt(req.params.id);
      const v = storage.updateExpertVerification(vId, {
        verifiedByAdmin: 1,
        updatedAt: new Date().toISOString(),
      });
      if (!v) return res.status(404).json({ error: true, message: "Verification not found" });
      writeExpertVerificationToCloudSql(v).catch(() => {});
      return res.json(v);
    } catch (e: any) {
      return res.status(500).json({ error: true, message: e.message });
    }
  });

  // ─── Convenience redirects (BUG-038-11/12) ───
  app.get("/admin", (_req, res) => res.redirect("/register#/admin"));
  app.get("/admin/{*path}", (_req, res) => res.redirect("/register#/admin"));
  app.get("/auth", (_req, res) => res.redirect("/register#/register"));
  app.get("/login", (_req, res) => res.redirect("/register#/login"));

  return httpServer;
}

