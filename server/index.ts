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
          const { storage: stor } = await import("./storage");
          const allUsers = stor.getAllUsers();
          const allExperts = stor.getAllExperts();
          const allRequests = stor.getAllRequests ? stor.getAllRequests() : [];
          await syncAllToCloudSql(allUsers, allExperts, allRequests);
          console.log("[STARTUP] Cloud SQL full sync complete");
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
            // Also sync Cloud SQL when we have new users
            const allRequests = storage.getAllRequests ? storage.getAllRequests() : [];
            await syncAllToCloudSql(allUsers, allExperts, allRequests);
            console.log(`[DAILY] New users detected (${allUsers.length}), report sent + Cloud SQL synced`);
          }
        } catch (err) {
          console.error("[DAILY] Failed:", err);
        }
      }, 60 * 60 * 1000); // check every hour, only send if new users
    },
  );
})();
