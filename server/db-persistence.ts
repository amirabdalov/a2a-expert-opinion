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

export async function backupDatabase(): Promise<void> {
  try {
    if (!existsSync(DB_PATH)) return;
    const token = await getGcpToken();
    if (!token) {
      console.log("[DB-BACKUP] No GCP token available, skipping backup");
      return;
    }
    const data = readFileSync(DB_PATH);
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(OBJECT)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(data.length),
      },
      body: data,
    });
    if (res.ok) {
      console.log(`[DB-BACKUP] Successfully backed up database to gs://${BUCKET}/${OBJECT}`);
    } else {
      console.error(`[DB-BACKUP] Backup failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("[DB-BACKUP] Error during backup:", err);
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

export function startPeriodicBackup(): void {
  setInterval(() => backupDatabase(), 60000);
  console.log("[DB-BACKUP] Periodic backup started (every 60s)");
}
