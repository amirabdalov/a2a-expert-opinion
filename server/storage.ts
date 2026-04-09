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
    const expertIds = [...new Set(reviews.filter((r) => r.expertId != null).map((r) => r.expertId!))];
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
}

export const storage = new DatabaseStorage();
