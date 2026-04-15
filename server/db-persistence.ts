import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const BUCKET = "a2a-global-data";
const OBJECT = "db/data.db";
const DB_PATH = resolve("data.db");

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

let lastBackupSuccess = false;
let backupAttempts = 0;

export function isBackupHealthy(): boolean { return lastBackupSuccess; }

export async function backupDatabase(): Promise<void> {
  try {
    if (!existsSync(DB_PATH)) {
      console.log("[DB-BACKUP] No data.db file found, nothing to backup");
      return;
    }
    const token = await getGcpToken();
    if (!token) {
      console.error("[DB-BACKUP] \u26a0\ufe0f NO GCP TOKEN AVAILABLE. Database is NOT being backed up. User data WILL BE LOST on next deploy!");
      console.error("[DB-BACKUP] This is normal in local dev. On Cloud Run, check service account permissions.");
      lastBackupSuccess = false;
      return;
    }
    const data = readFileSync(DB_PATH);
    if (data.length < 100) {
      console.log("[DB-BACKUP] Database too small, skipping (likely empty)");
      return;
    }
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
    const responseText = await res.text();
    if (res.ok) {
      lastBackupSuccess = true;
      console.log(`[DB-BACKUP] \u2705 Success: ${data.length} bytes \u2192 gs://${BUCKET}/${OBJECT} (attempt #${backupAttempts})`);
    } else {
      lastBackupSuccess = false;
      console.error(`[DB-BACKUP] \u274c FAILED (attempt #${backupAttempts}): HTTP ${res.status}`);
      console.error(`[DB-BACKUP] Response: ${responseText.substring(0, 500)}`);
      if (res.status === 403) {
        console.error(`[DB-BACKUP] \u26a0\ufe0f PERMISSION DENIED. Run this command to fix:`);
        console.error(`[DB-BACKUP] gcloud storage buckets add-iam-policy-binding gs://${BUCKET} --member="serviceAccount:506299896481-compute@developer.gserviceaccount.com" --role="roles/storage.admin" --project=winter-jet-492110-g9`);
      }
    }
  } catch (err) {
    lastBackupSuccess = false;
    console.error("[DB-BACKUP] \u274c Exception during backup:", err);
  }
}

export async function restoreDatabase(): Promise<void> {
  try {
    const token = await getGcpToken();
    if (!token) {
      console.log("[DB-RESTORE] No GCP token available, skipping restore");
      return;
    }
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(OBJECT)}?alt=media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      if (res.status === 404) {
        console.log("[DB-RESTORE] No backup found in GCS, starting fresh");
      } else {
        console.error(`[DB-RESTORE] Failed to download backup: ${res.status}`);
      }
      return;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    writeFileSync(DB_PATH, buf);
    console.log(`[DB-RESTORE] Database restored from gs://${BUCKET}/${OBJECT} (${buf.length} bytes)`);
  } catch (err) {
    console.error("[DB-RESTORE] Error during restore:", err);
  }
}

// Debounced backup: triggers 5 seconds after last write, prevents excessive uploads
let backupTimer: ReturnType<typeof setTimeout> | null = null;
export function triggerBackup(): void {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => backupDatabase(), 5000);
}

export function startPeriodicBackup(): void {
  // For the first 5 minutes after startup, backup every 10 seconds.
  // After 5 minutes, switch to every 60 seconds.
  const FAST_INTERVAL_MS = 10_000;   // 10 seconds
  const SLOW_INTERVAL_MS = 60_000;   // 60 seconds
  const FAST_PHASE_DURATION_MS = 5 * 60_000; // 5 minutes

  let fastTimer: ReturnType<typeof setInterval> | null = setInterval(() => backupDatabase(), FAST_INTERVAL_MS);
  console.log("[DB-BACKUP] Periodic backup started (fast phase: every 10s for 5min)");

  setTimeout(() => {
    if (fastTimer) {
      clearInterval(fastTimer);
      fastTimer = null;
    }
    setInterval(() => backupDatabase(), SLOW_INTERVAL_MS);
    console.log("[DB-BACKUP] Switched to slow backup phase (every 60s)");
  }, FAST_PHASE_DURATION_MS);
}
