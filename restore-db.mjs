#!/usr/bin/env node
/**
 * Standalone pre-start script: restores the SQLite database from GCS.
 * Run before app starts: node restore-db.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const BUCKET = "a2a-global-data";
const OBJECT = "db/data.db";
const DB_PATH = resolve("data.db");

async function getGcpToken() {
  try {
    const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.access_token;
  } catch {
    return null;
  }
}

async function restoreDatabase() {
  console.log("[RESTORE] Starting database restore from GCS...");

  const token = await getGcpToken();
  if (!token) {
    console.log("[RESTORE] No GCP token available. Running without restore.");
    return;
  }

  const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(OBJECT)}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    if (res.status === 404) {
      console.log("[RESTORE] No backup found in GCS. Starting fresh.");
    } else {
      const text = await res.text();
      console.error(`[RESTORE] Failed to download backup: ${res.status} ${text}`);
    }
    return;
  }

  const arrayBuffer = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  writeFileSync(DB_PATH, buf);
  console.log(`[RESTORE] Database restored from gs://${BUCKET}/${OBJECT} (${buf.length} bytes)`);
}

restoreDatabase().catch((err) => {
  console.error("[RESTORE] Unexpected error:", err);
  process.exit(0); // Don't block app start on restore failure
});
