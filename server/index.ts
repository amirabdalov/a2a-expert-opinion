import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import helmet from "helmet";
import cors from "cors";
import { startPeriodicBackup, backupDatabase, triggerBackup } from "./db-persistence";
import { sendFullUserDataEmail, initCloudSql, syncAllToCloudSql, restoreFromCloudSql } from "./user-data-persist";

// Export triggerBackup so routes.ts can call it after writes
export { triggerBackup };

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Security headers (relaxed for sandbox iframe)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

// CORS
app.use(cors());

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse).slice(0, 200)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // Global error handler
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ error: true, message, code: "INTERNAL_ERROR" });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // MISSION CRITICAL: Restore data from Cloud SQL BEFORE listening
  // Cloud Run ephemeral disk means SQLite only has seed data on cold start.
  // This restores all production data (users, experts, requests, transactions).
  try {
    const { sqlite: sqliteDb } = await import("./storage");
    await initCloudSql();
    await restoreFromCloudSql(sqliteDb);
    console.log("[STARTUP] Cloud SQL → SQLite restore complete");
    // Build 39 Fix 2: Wallet reconciliation removed. Cloud SQL is the source of truth
    // for wallet_balance. The restore step above copies correct values directly.
    // No separate reconciliation needed — it would cause double-deduction.
  } catch (err) {
    console.error("[STARTUP] Cloud SQL restore failed — starting with seed data:", err);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      // BUG-008: Start periodic GCS backup
      startPeriodicBackup();
      // Wait for initial backup to succeed before considering server ready
      backupDatabase().then(() => {
        console.log("[STARTUP] Initial backup complete");
      }).catch(() => {
        console.error("[STARTUP] Initial backup failed — data may not persist");
      });

      // Layer 4: Sync SQLite → Cloud SQL (restore already happened pre-listen)
      (async () => {
        try {
          const { storage: stor, sqlite: sqlDb } = await import("./storage");
          const allUsers = stor.getAllUsers();
          const allExperts = stor.getAllExperts();
          const allRequests = stor.getAllRequests ? stor.getAllRequests() : [];
          // OB-A: Gather ALL tables for full sync
          const reviews = sqlDb.prepare("SELECT * FROM expert_reviews").all() as any[];
          const messages = sqlDb.prepare("SELECT * FROM messages").all() as any[];
          const notifications = sqlDb.prepare("SELECT * FROM notifications").all() as any[];
          const events = sqlDb.prepare("SELECT * FROM request_events").all() as any[];
          const walletTx = stor.getAllWalletTransactions();
          const withdrawals = stor.getAllWithdrawals();
          const invoices = sqlDb.prepare("SELECT * FROM invoices").all() as any[];
          const verificationTests = sqlDb.prepare("SELECT * FROM verification_tests").all() as any[];
          const expertVerifications = sqlDb.prepare("SELECT * FROM expert_verifications").all() as any[];
          const withdrawalRequests = sqlDb.prepare("SELECT * FROM withdrawal_requests").all() as any[];
          await syncAllToCloudSql(allUsers, allExperts, allRequests, {
            reviews, messages, notifications, events, walletTx,
            withdrawals, invoices, verificationTests, expertVerifications, withdrawalRequests,
          });
          console.log("[STARTUP] Cloud SQL full sync complete (all tables)");
        } catch (err) {
          console.error("[STARTUP] Cloud SQL sync failed:", err);
        }
      })();

      // FIX-1: Only send full user data email when new users have been added.
      // Track user count to avoid spamming cofounders on every cold start.
      let lastReportedUserCount = 0;

      // Check every hour, only send report if user count has grown
      setInterval(async () => {
        try {
          const { storage } = await import("./storage");
          const allUsers = storage.getAllUsers();
          if (allUsers.length > lastReportedUserCount) {
            lastReportedUserCount = allUsers.length;
            const allExperts = storage.getAllExperts();
            await sendFullUserDataEmail(allUsers, allExperts);
            const allRequests = storage.getAllRequests ? storage.getAllRequests() : [];
            await syncAllToCloudSql(allUsers, allExperts, allRequests);
            console.log(`[HOURLY] New users detected (${allUsers.length}), report sent + Cloud SQL synced`);
          }
        } catch (err) {
          console.error("[HOURLY] Failed:", err);
        }
      }, 60 * 60 * 1000);

      // Build 45.2 — unconditional safety-net sync every 5 minutes.
      // Guards against any storage.create*/update* site that forgot to fire
      // a per-entity Cloud SQL write. Without this, SQLite-only rows vanish
      // on the next Cloud Run revision flip (root cause of the "Failed to
      // load expert profile" bug reported on staging 2026-04-21).
      setInterval(async () => {
        try {
          const { storage: stor, sqlite: sqlDb } = await import("./storage");
          const allUsers = stor.getAllUsers();
          const allExperts = stor.getAllExperts();
          const allRequests = stor.getAllRequests ? stor.getAllRequests() : [];
          const reviews = sqlDb.prepare("SELECT * FROM expert_reviews").all() as any[];
          const messages = sqlDb.prepare("SELECT * FROM messages").all() as any[];
          const notifications = sqlDb.prepare("SELECT * FROM notifications").all() as any[];
          const events = sqlDb.prepare("SELECT * FROM request_events").all() as any[];
          const walletTx = stor.getAllWalletTransactions();
          const withdrawals = stor.getAllWithdrawals();
          const invoices = sqlDb.prepare("SELECT * FROM invoices").all() as any[];
          const verificationTests = sqlDb.prepare("SELECT * FROM verification_tests").all() as any[];
          const expertVerifications = sqlDb.prepare("SELECT * FROM expert_verifications").all() as any[];
          const withdrawalRequests = sqlDb.prepare("SELECT * FROM withdrawal_requests").all() as any[];
          await syncAllToCloudSql(allUsers, allExperts, allRequests, {
            reviews, messages, notifications, events, walletTx,
            withdrawals, invoices, verificationTests, expertVerifications, withdrawalRequests,
          });
          console.log(`[PERIODIC-SYNC] Safety-net sync OK (users=${allUsers.length}, experts=${allExperts.length}, requests=${allRequests.length})`);
        } catch (err) {
          console.error("[PERIODIC-SYNC] Failed:", err);
        }
      }, 5 * 60 * 1000); // every 5 minutes
    },
  );
})();
