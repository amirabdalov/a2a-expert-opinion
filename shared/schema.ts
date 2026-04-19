import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique().default(""),
  password: text("password").notNull().default(""),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("client"),
  credits: integer("credits").notNull().default(5),
  company: text("company"),
  accountType: text("account_type").notNull().default("individual"),
  walletBalance: integer("wallet_balance").notNull().default(0),
  active: integer("active").notNull().default(1),
  tourCompleted: integer("tour_completed").notNull().default(0),
  photo: text("photo"),
  loginCount: integer("login_count").notNull().default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const admins = sqliteTable("admins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const experts = sqliteTable("experts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  bio: text("bio").notNull().default(""),
  expertise: text("expertise").notNull().default(""),
  credentials: text("credentials").notNull().default(""),
  rating: integer("rating").notNull().default(50),
  totalReviews: integer("total_reviews").notNull().default(0),
  verified: integer("verified").notNull().default(0),
  categories: text("categories").notNull().default("[]"),
  availability: integer("availability").notNull().default(1),
  hourlyRate: integer("hourly_rate"),
  responseTime: text("response_time"),
  education: text("education").notNull().default(""),
  yearsExperience: integer("years_experience").notNull().default(0),
  onboardingComplete: integer("onboarding_complete").notNull().default(0),
  verificationScore: integer("verification_score"),
  ratePerMinute: text("rate_per_minute"),
  rateTier: text("rate_tier"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const verificationTests = sqliteTable("verification_tests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expertId: integer("expert_id").notNull().references(() => experts.id),
  category: text("category").notNull(),
  answers: text("answers").notNull().default("[]"),
  score: integer("score").notNull().default(0),
  passed: integer("passed").notNull().default(0),
  createdAt: text("created_at").notNull().default("now"),
  updatedAt: text("updated_at"),
});

export const requests = sqliteTable("requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  expertId: integer("expert_id").references(() => experts.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  tier: text("tier").notNull().default("standard"),
  status: text("status").notNull().default("pending"),
  creditsCost: integer("credits_cost").notNull().default(1),
  expertResponse: text("expert_response"),
  createdAt: text("created_at").notNull().default("now"),
  deadline: text("deadline"),
  serviceType: text("service_type").notNull().default("rate"),
  aiResponse: text("ai_response"),
  attachments: text("attachments").notNull().default("[]"),
  expertsNeeded: integer("experts_needed").notNull().default(1),
  instructions: text("instructions"),
  llmProvider: text("llm_provider"),
  llmModel: text("llm_model"),
  pricePerMinute: text("price_per_minute"),
  priceTier: text("price_tier"),
  serviceCategory: text("service_category"),
  clientRating: integer("client_rating"),
  clientRatingComment: text("client_rating_comment"),
  refunded: integer("refunded").default(0),
  updatedAt: text("updated_at"),
});

export const expertReviews = sqliteTable("expert_reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: integer("request_id").notNull().references(() => requests.id),
  expertId: integer("expert_id").references(() => experts.id),
  status: text("status").notNull().default("pending"),
  rating: integer("rating"),
  ratingComment: text("rating_comment"),
  correctPoints: text("correct_points"),
  incorrectPoints: text("incorrect_points"),
  suggestions: text("suggestions"),
  deliverable: text("deliverable"),
  createdAt: text("created_at").notNull().default("now"),
  completedAt: text("completed_at"),
  invoiced: integer("invoiced").notNull().default(0),
  updatedAt: text("updated_at"),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: integer("request_id").notNull().references(() => requests.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().default("now"),
  updatedAt: text("updated_at"),
});

export const creditTransactions = sqliteTable("credit_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  takeRatePercent: integer("take_rate_percent"),
  platformFee: integer("platform_fee"),
  expertPayout: integer("expert_payout"),
  clientPaid: integer("client_paid"),
  createdAt: text("created_at").notNull().default("now"),
  updatedAt: text("updated_at"),
});

export const walletTransactions = sqliteTable("wallet_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  type: text("type").notNull(),
  stripePaymentId: text("stripe_payment_id"),
  description: text("description"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: integer("read").notNull().default(0),
  link: text("link"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const requestEvents = sqliteTable("request_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: integer("request_id").notNull(),
  type: text("type").notNull(),
  actorId: integer("actor_id"),
  actorName: text("actor_name"),
  message: text("message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const withdrawals = sqliteTable("withdrawals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  expertId: integer("expert_id"),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
  processedAt: text("processed_at"),
  updatedAt: text("updated_at"),
});

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expertId: integer("expert_id").notNull(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  totalAmount: integer("total_amount").notNull(),
  platformFee: integer("platform_fee").notNull(),
  netPayout: integer("net_payout").notNull(),
  status: text("status").notNull().default("pending"),
  lineItems: text("line_items").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExpertSchema = createInsertSchema(experts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRequestSchema = createInsertSchema(requests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExpertReviewSchema = createInsertSchema(expertReviews).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVerificationTestSchema = createInsertSchema(verificationTests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({ id: true, updatedAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, updatedAt: true });
export const insertAdminSchema = createInsertSchema(admins).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRequestEventSchema = createInsertSchema(requestEvents).omit({ id: true, updatedAt: true });
export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({ id: true, updatedAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, updatedAt: true });
// pageViews and registrationSources tables must be defined before insert schemas
export const pageViews = sqliteTable("page_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  path: text("path").notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  sessionId: text("session_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const registrationSources = sqliteTable("registration_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  referrer: text("referrer"),
  landingPage: text("landing_page"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const insertPageViewSchema = createInsertSchema(pageViews).omit({ id: true, updatedAt: true });
export const insertRegistrationSourceSchema = createInsertSchema(registrationSources).omit({ id: true, updatedAt: true });

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertExpert = z.infer<typeof insertExpertSchema>;
export type Expert = typeof experts.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Request = typeof requests.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertExpertReview = z.infer<typeof insertExpertReviewSchema>;
export type ExpertReview = typeof expertReviews.$inferSelect;
export type InsertVerificationTest = z.infer<typeof insertVerificationTestSchema>;
export type VerificationTest = typeof verificationTests.$inferSelect;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type RequestEvent = typeof requestEvents.$inferSelect;
export type InsertRequestEvent = z.infer<typeof insertRequestEventSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = z.infer<typeof insertPageViewSchema>;
export type RegistrationSource = typeof registrationSources.$inferSelect;
export type InsertRegistrationSource = z.infer<typeof insertRegistrationSourceSchema>;

// Login schema (legacy password-based — kept for reference)
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(3).optional(),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  isExpert: z.boolean().optional(),
});

// OTP auth schemas
export const otpRegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["expert", "client"]),
});

export const otpVerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export const otpLoginSchema = z.object({
  email: z.string().email(),
});

export const legalAcceptances = sqliteTable("legal_acceptances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  documentType: text("document_type").notNull(),
  documentVersion: text("document_version").notNull().default("April 2026"),
  acceptedAt: text("accepted_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export type LegalAcceptance = typeof legalAcceptances.$inferSelect;
export type InsertLegalAcceptance = typeof legalAcceptances.$inferInsert;

// OB-J: Expert bank/verification details for withdrawal cycle
export const expertVerifications = sqliteTable("expert_verifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expertId: integer("expert_id").notNull(),
  passportFileUrl: text("passport_file_url"),
  // BUG-3: Expanded verification fields
  governmentIdType: text("government_id_type"),
  governmentIdNumber: text("government_id_number"),
  fullLegalName: text("full_legal_name"),
  country: text("country"),
  fullAddress: text("full_address"),
  accountNumber: text("account_number"),
  swiftCode: text("swift_code"),
  bankName: text("bank_name"),
  bankAddress: text("bank_address"),
  accountHolderName: text("account_holder_name"),
  bankCountry: text("bank_country"),
  iban: text("iban"),
  routingNumber: text("routing_number"),
  sortCode: text("sort_code"),
  ifscCode: text("ifsc_code"),
  apartmentStreet: text("apartment_street"),
  city: text("city"),
  stateProvince: text("state_province"),
  postalCode: text("postal_code"),
  verifiedByAdmin: integer("verified_by_admin").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertExpertVerificationSchema = createInsertSchema(expertVerifications).omit({ id: true });
export type ExpertVerification = typeof expertVerifications.$inferSelect;
export type InsertExpertVerification = z.infer<typeof insertExpertVerificationSchema>;

// OB-J: Withdrawal requests with invoice numbers
export const withdrawalRequests = sqliteTable("withdrawal_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expertId: integer("expert_id").notNull(),
  amount: text("amount").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({ id: true });
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;

// Audit log table for tracking data changes during restore/sync
export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tableName: text("table_name").notNull(),
  rowId: integer("row_id").notNull(),
  action: text("action").notNull(), // 'INSERT', 'UPDATE', 'SKIP', 'DELETE_BLOCKED'
  oldValue: text("old_value"),       // JSON
  newValue: text("new_value"),       // JSON
  reason: text("reason"),            // 'restore', 'sync', 'api_call', 'admin'
  createdAt: text("created_at").notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true });
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Take rate history table for tracking rate changes over time
export const takeRateHistory = sqliteTable("take_rate_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tier: text("tier").notNull(),
  rate: integer("rate").notNull(), // stored as percentage (50 = 50%)
  effectiveFrom: text("effective_from").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertTakeRateHistorySchema = createInsertSchema(takeRateHistory).omit({ id: true });
export type TakeRateHistory = typeof takeRateHistory.$inferSelect;
export type InsertTakeRateHistory = z.infer<typeof insertTakeRateHistorySchema>;
