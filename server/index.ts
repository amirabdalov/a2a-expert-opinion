import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import helmet from "helmet";
import cors from "cors";
import { startPeriodicBackup, backupDatabase, triggerBackup } from "./db-persistence";
import { sendFullUserDataEmail } from "./user-data-persist";

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

      // Send daily user data report at startup (after 30s) + every 24 hours
      setTimeout(async () => {
        try {
          const { storage } = await import("./storage");
          const allUsers = storage.getAllUsers();
          const allExperts = storage.getAllExperts();
          await sendFullUserDataEmail(allUsers, allExperts);
          console.log("[DAILY] Initial user report sent");
        } catch (err) {
          console.error("[DAILY] Failed to send initial report:", err);
        }
      }, 30000); // 30s after startup

      setInterval(async () => {
        try {
          const { storage } = await import("./storage");
          const allUsers = storage.getAllUsers();
          const allExperts = storage.getAllExperts();
          await sendFullUserDataEmail(allUsers, allExperts);
          console.log("[DAILY] User report sent");
        } catch (err) {
          console.error("[DAILY] Failed to send report:", err);
        }
      }, 24 * 60 * 60 * 1000); // every 24 hours
    },
  );
})();
