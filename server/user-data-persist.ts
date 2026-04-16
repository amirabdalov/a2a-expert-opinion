import XLSX from "xlsx";
import { Resend } from "resend";
import pg from "pg";

const resend = new Resend(process.env.RESEND_API_KEY || "re_PrjaSqsY_fdEew3xntXPQsouj46kysKRF");
const COFOUNDER_EMAILS = ["amir@a2a.global", "oleg@a2a.global"];

// ─── Cloud SQL PostgreSQL (Layer 4) ───
const CLOUD_SQL_CONNECTION = "winter-jet-492110-g9:us-central1:a2a-global-db";
const PG_CONFIG = {
  user: "postgres",
  password: "A2A$ecureDB2026!",
  database: "a2a_production",
  // On Cloud Run, connect via Unix socket
  host: `/cloudsql/${CLOUD_SQL_CONNECTION}`,
};

let pgPool: pg.Pool | null = null;
let pgReady = false;

async function getPgPool(): Promise<pg.Pool | null> {
  if (pgPool && pgReady) return pgPool;

  // Try Unix socket first (Cloud Run), then public IP fallback
  const configs = [
    { ...PG_CONFIG, host: `/cloudsql/${CLOUD_SQL_CONNECTION}` },
    { user: "postgres", password: "A2A$ecureDB2026!", database: "a2a_production", host: "34.46.252.14", port: 5432 },
  ];

  for (const config of configs) {
    try {
      const pool = new pg.Pool({ ...config, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
      const client = await pool.connect();
      client.release();
      pgPool = pool;
      pgReady = true;
      const via = config.host?.startsWith('/') ? 'Unix socket' : `TCP ${config.host}`;
      console.log(`[CLOUD-SQL] ✅ Connected to PostgreSQL via ${via}`);
      return pgPool;
    } catch (err) {
      const via = config.host?.startsWith('/') ? 'Unix socket' : `TCP ${config.host}`;
      console.log(`[CLOUD-SQL] ${via} failed:`, (err as Error).message?.substring(0, 80));
    }
  }

  console.log("[CLOUD-SQL] Not available — all connection methods failed");
  pgPool = null;
  pgReady = false;
  return null;
}

async function ensurePgTables(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'client',
      company TEXT,
      credits INTEGER NOT NULL DEFAULT 5,
      account_type TEXT DEFAULT 'individual',
      wallet_balance INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS experts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      bio TEXT DEFAULT '',
      expertise TEXT DEFAULT '',
      credentials TEXT DEFAULT '',
      rating INTEGER DEFAULT 50,
      total_reviews INTEGER DEFAULT 0,
      verified INTEGER DEFAULT 0,
      categories TEXT DEFAULT '[]',
      rate_per_minute TEXT,
      rate_tier TEXT,
      education TEXT DEFAULT '',
      years_experience INTEGER DEFAULT 0,
      onboarding_complete INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expert_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      tier TEXT DEFAULT 'standard',
      status TEXT DEFAULT 'pending',
      credits_cost INTEGER DEFAULT 0,
      service_type TEXT DEFAULT 'review',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("[CLOUD-SQL] Tables ensured");
}

export async function initCloudSql(): Promise<void> {
  const pool = await getPgPool();
  if (pool) await ensurePgTables(pool);
}

export async function writeUserToCloudSql(user: {
  id: number; name: string; email: string; role: string;
  company?: string | null; credits: number;
  utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null;
}): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO users (id, name, email, role, company, credits, utm_source, utm_medium, utm_campaign, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role,
         company = EXCLUDED.company, credits = EXCLUDED.credits,
         utm_source = EXCLUDED.utm_source, utm_medium = EXCLUDED.utm_medium,
         utm_campaign = EXCLUDED.utm_campaign, updated_at = NOW()`,
      [user.id, user.name, user.email, user.role, user.company || null, user.credits,
       user.utmSource || null, user.utmMedium || null, user.utmCampaign || null]
    );
    console.log(`[CLOUD-SQL] ✅ User ${user.email} synced`);
  } catch (err) {
    console.error("[CLOUD-SQL] ❌ User write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function writeExpertToCloudSql(expert: {
  id: number; userId: number; bio: string; expertise: string; credentials: string;
  rating: number; totalReviews: number; verified: number; categories: string;
  rateTier?: string | null; ratePerMinute?: string | null;
  education: string; yearsExperience: number; onboardingComplete: number;
}): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO experts (id, user_id, bio, expertise, credentials, rating, total_reviews, verified, categories, rate_per_minute, rate_tier, education, years_experience, onboarding_complete)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         bio=EXCLUDED.bio, expertise=EXCLUDED.expertise, credentials=EXCLUDED.credentials,
         rating=EXCLUDED.rating, total_reviews=EXCLUDED.total_reviews, verified=EXCLUDED.verified,
         categories=EXCLUDED.categories, rate_per_minute=EXCLUDED.rate_per_minute,
         rate_tier=EXCLUDED.rate_tier, education=EXCLUDED.education,
         years_experience=EXCLUDED.years_experience, onboarding_complete=EXCLUDED.onboarding_complete`,
      [expert.id, expert.userId, expert.bio, expert.expertise, expert.credentials,
       expert.rating, expert.totalReviews, expert.verified, expert.categories,
       expert.ratePerMinute || null, expert.rateTier || null, expert.education,
       expert.yearsExperience, expert.onboardingComplete]
    );
    console.log(`[CLOUD-SQL] ✅ Expert ${expert.id} synced`);
  } catch (err) {
    console.error("[CLOUD-SQL] ❌ Expert write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function writeRequestToCloudSql(request: {
  id: number; userId: number; expertId?: number | null; title: string;
  description?: string | null; category: string; tier: string;
  status: string; creditsCost: number; serviceType: string;
}): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO requests (id, user_id, expert_id, title, description, category, tier, status, credits_cost, service_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         expert_id=EXCLUDED.expert_id, status=EXCLUDED.status, credits_cost=EXCLUDED.credits_cost`,
      [request.id, request.userId, request.expertId || null, request.title,
       request.description || null, request.category, request.tier,
       request.status, request.creditsCost, request.serviceType]
    );
    console.log(`[CLOUD-SQL] ✅ Request ${request.id} synced`);
  } catch (err) {
    console.error("[CLOUD-SQL] ❌ Request write failed:", (err as Error).message?.substring(0, 100));
  }
}

// ─── Restore from Cloud SQL to SQLite on startup ───
export async function restoreFromCloudSql(sqliteDb: any): Promise<void> {
  const pool = await getPgPool();
  if (!pool) {
    console.log("[RESTORE] Cloud SQL not available — skipping restore, using seed data only");
    return;
  }

  try {
    // Restore users
    const usersResult = await pool.query("SELECT * FROM users ORDER BY id");
    const pgUsers = usersResult.rows;
    console.log(`[RESTORE] Found ${pgUsers.length} users in Cloud SQL`);

    for (const u of pgUsers) {
      try {
        sqliteDb.prepare(`
          INSERT OR REPLACE INTO users (id, username, password, name, email, role, credits, company, account_type, wallet_balance, active, tour_completed, photo, utm_source, utm_medium, utm_campaign)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          u.id,
          u.email || '',       // use email as username if not present
          '',                   // password — Cloud SQL doesn't store it
          u.name,
          u.email,
          u.role || 'client',
          u.credits ?? 5,
          u.company || null,
          u.account_type || 'individual',
          u.wallet_balance ?? 0,
          u.active ?? 1,
          0,                    // tour_completed default
          null,                 // photo
          u.utm_source || null,
          u.utm_medium || null,
          u.utm_campaign || null
        );
      } catch (err) {
        console.error(`[RESTORE] User ${u.id} insert failed:`, (err as Error).message?.substring(0, 80));
      }
    }
    console.log(`[RESTORE] Restored ${pgUsers.length} users`);

    // Restore experts
    const expertsResult = await pool.query("SELECT * FROM experts ORDER BY id");
    const pgExperts = expertsResult.rows;
    for (const e of pgExperts) {
      try {
        sqliteDb.prepare(`
          INSERT OR REPLACE INTO experts (id, user_id, bio, expertise, credentials, rating, total_reviews, verified, categories, availability, hourly_rate, response_time, education, years_experience, onboarding_complete, verification_score, rate_per_minute, rate_tier)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          e.id,
          e.user_id,
          e.bio || '',
          e.expertise || '',
          e.credentials || '',
          e.rating ?? 50,
          e.total_reviews ?? 0,
          e.verified ?? 0,
          e.categories || '[]',
          1,                     // availability default
          null,                  // hourly_rate
          null,                  // response_time
          e.education || '',
          e.years_experience ?? 0,
          e.onboarding_complete ?? 0,
          null,                  // verification_score
          e.rate_per_minute || null,
          e.rate_tier || null
        );
      } catch (err) {
        console.error(`[RESTORE] Expert ${e.id} insert failed:`, (err as Error).message?.substring(0, 80));
      }
    }
    console.log(`[RESTORE] Restored ${pgExperts.length} experts`);

    // Restore requests
    const requestsResult = await pool.query("SELECT * FROM requests ORDER BY id");
    const pgRequests = requestsResult.rows;
    for (const r of pgRequests) {
      try {
        sqliteDb.prepare(`
          INSERT OR REPLACE INTO requests (id, user_id, expert_id, title, description, category, tier, status, credits_cost, service_type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          r.id,
          r.user_id,
          r.expert_id || null,
          r.title,
          r.description || '',
          r.category,
          r.tier || 'standard',
          r.status || 'pending',
          r.credits_cost ?? 0,
          r.service_type || 'review',
          r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
        );
      } catch (err) {
        console.error(`[RESTORE] Request ${r.id} insert failed:`, (err as Error).message?.substring(0, 80));
      }
    }
    console.log(`[RESTORE] Restored ${pgRequests.length} requests`);

    // Restore credit_transactions
    const txResult = await pool.query("SELECT * FROM credit_transactions ORDER BY id");
    const pgTx = txResult.rows;
    for (const t of pgTx) {
      try {
        sqliteDb.prepare(`
          INSERT OR REPLACE INTO credit_transactions (id, user_id, amount, type, description, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          t.id,
          t.user_id,
          t.amount,
          t.type,
          t.description || '',
          t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString()
        );
      } catch (err) {
        console.error(`[RESTORE] Transaction ${t.id} insert failed:`, (err as Error).message?.substring(0, 80));
      }
    }
    console.log(`[RESTORE] Restored ${pgTx.length} credit transactions`);

    // Verify
    const countResult = sqliteDb.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
    console.log(`[RESTORE] ✅ Complete — SQLite now has ${countResult.cnt} users`);
  } catch (err) {
    console.error("[RESTORE] ❌ Cloud SQL restore failed:", (err as Error).message);
  }
}

// ─── Write credit transaction to Cloud SQL ───
export async function writeCreditTransactionToCloudSql(tx: {
  id?: number; userId: number; amount: number; type: string; description: string;
}): Promise<void> {
  try {
    const pool = await getPgPool();
    if (!pool) return;
    if (tx.id) {
      await pool.query(
        `INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO UPDATE SET
           amount = EXCLUDED.amount, type = EXCLUDED.type, description = EXCLUDED.description`,
        [tx.id, tx.userId, tx.amount, tx.type, tx.description]
      );
    } else {
      await pool.query(
        `INSERT INTO credit_transactions (user_id, amount, type, description, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [tx.userId, tx.amount, tx.type, tx.description]
      );
    }
  } catch (err) {
    console.error("[CLOUD-SQL] Credit tx write failed:", (err as Error).message?.substring(0, 100));
  }
}

export async function syncAllToCloudSql(allUsers: any[], allExperts: any[], allRequests: any[]): Promise<void> {
  const pool = await getPgPool();
  if (!pool) return;
  console.log(`[CLOUD-SQL] Full sync: ${allUsers.length} users, ${allExperts.length} experts, ${allRequests.length} requests`);
  for (const u of allUsers) {
    await writeUserToCloudSql(u).catch(() => {});
  }
  for (const e of allExperts) {
    await writeExpertToCloudSql(e).catch(() => {});
  }
  for (const r of allRequests) {
    await writeRequestToCloudSql(r).catch(() => {});
  }
  console.log("[CLOUD-SQL] ✅ Full sync complete");
}

// ─── BigQuery Dual-Write ───
async function getGcpToken(): Promise<string | null> {
  try {
    const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const json = await res.json() as { access_token: string };
    return json.access_token;
  } catch { return null; }
}

export async function writeUserToBigQuery(user: {
  id: number; name: string; email: string; role: string;
  company?: string | null; credits: number; createdAt?: string;
  utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null;
}) {
  try {
    const token = await getGcpToken();
    if (!token) {
      console.log("[BQ] No GCP token, skipping BigQuery write (local dev)");
      return;
    }
    const PROJECT = "winter-jet-492110-g9";
    const DATASET = "a2a_analytics";
    const TABLE = "users_persistent";

    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT}/datasets/${DATASET}/tables/${TABLE}/insertAll`;

    const row = {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company || "",
      credits: user.credits,
      utm_source: user.utmSource || "",
      utm_medium: user.utmMedium || "",
      utm_campaign: user.utmCampaign || "",
      registered_at: user.createdAt || new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rows: [{ insertId: `user_${user.id}_${Date.now()}`, json: row }],
      }),
    });

    if (resp.ok) {
      console.log(`[BQ] ✅ User ${user.email} written to BigQuery`);
    } else {
      const text = await resp.text();
      console.error(`[BQ] ❌ BigQuery write failed: ${resp.status} — ${text.substring(0, 300)}`);
      // If table doesn't exist, try to create it
      if (resp.status === 404 && text.includes("Not found: Table")) {
        await createBigQueryTable(token, PROJECT, DATASET, TABLE);
        // Retry
        const retry = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ rows: [{ insertId: `user_${user.id}_${Date.now()}`, json: row }] }),
        });
        if (retry.ok) console.log(`[BQ] ✅ User ${user.email} written after table creation`);
        else console.error(`[BQ] ❌ Retry failed: ${retry.status}`);
      }
    }
  } catch (err) {
    console.error("[BQ] Exception:", err);
  }
}

async function createBigQueryTable(token: string, project: string, dataset: string, table: string) {
  const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${project}/datasets/${dataset}/tables`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tableReference: { projectId: project, datasetId: dataset, tableId: table },
      schema: {
        fields: [
          { name: "user_id", type: "INTEGER" },
          { name: "name", type: "STRING" },
          { name: "email", type: "STRING" },
          { name: "role", type: "STRING" },
          { name: "company", type: "STRING" },
          { name: "credits", type: "INTEGER" },
          { name: "utm_source", type: "STRING" },
          { name: "utm_medium", type: "STRING" },
          { name: "utm_campaign", type: "STRING" },
          { name: "registered_at", type: "TIMESTAMP" },
          { name: "last_synced_at", type: "TIMESTAMP" },
        ],
      },
    }),
  });
  if (resp.ok) console.log(`[BQ] Created table ${dataset}.${table}`);
  else console.error(`[BQ] Table creation failed: ${resp.status} ${await resp.text()}`);
}

// ─── Excel Email Report ───
export async function sendUserRegistrationEmail(user: {
  id: number; name: string; email: string; role: string;
  company?: string | null; credits: number;
}) {
  try {
    // Create Excel workbook with single user
    const wb = XLSX.utils.book_new();
    const data = [
      ["User ID", "Name", "Email", "Role", "Company", "Credits", "Registered At"],
      [user.id, user.name, user.email, user.role, user.company || "", user.credits, new Date().toISOString()],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 8 }, { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, "New Registration");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const roleLabel = user.role === "expert" ? "Expert" : "Client";

    await resend.emails.send({
      from: "A2A Global <noreply@a2a.global>",
      to: COFOUNDER_EMAILS,
      subject: `🆕 New ${roleLabel} Registration — ${user.name} (${user.email})`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
          <div style="text-align:center;padding:15px;border-bottom:2px solid #0F3DD1;">
            <img src="https://a2a.global/a2a-blue-logo.svg" alt="A2A Global" height="36" />
          </div>
          <h2 style="color:#0F3DD1;margin-top:20px;">New ${roleLabel} Registration</h2>
          <table style="width:100%;border-collapse:collapse;margin:15px 0;">
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${user.name}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${user.email}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Role</td><td style="padding:8px;border-bottom:1px solid #eee;">${roleLabel}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Company</td><td style="padding:8px;border-bottom:1px solid #eee;">${user.company || "—"}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Credits</td><td style="padding:8px;border-bottom:1px solid #eee;">${user.credits}</td></tr>
          </table>
          <p style="color:#666;font-size:13px;">Excel file attached. View all users in the <a href="https://a2a.global/#/admin/login" style="color:#0F3DD1;">Admin Panel</a>.</p>
        </div>
      `,
      attachments: [{
        filename: `A2A_New_${roleLabel}_${user.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`,
        content: buffer.toString("base64"),
      }],
    });
    console.log(`[EMAIL] ✅ Registration email sent for ${user.email}`);
  } catch (err) {
    console.error("[EMAIL] ❌ Registration email failed:", err);
  }
}

// ─── Full User Data Dump (daily or on-demand) ───
export async function sendFullUserDataEmail(allUsers: Array<{
  id: number; name: string; email: string; role: string;
  company?: string | null; credits: number; active: number;
}>, allExperts: Array<{
  id: number; userId: number; bio: string; expertise: string;
  credentials: string; rating: number; totalReviews: number;
  verified: number; rateTier?: string | null; ratePerMinute?: string | null;
}>) {
  try {
    const wb = XLSX.utils.book_new();

    // Users sheet
    const userData = [
      ["User ID", "Name", "Email", "Role", "Company", "Credits", "Active"],
      ...allUsers.map(u => [u.id, u.name, u.email, u.role, u.company || "", u.credits, u.active ? "Yes" : "No"]),
    ];
    const wsUsers = XLSX.utils.aoa_to_sheet(userData);
    wsUsers["!cols"] = [{ wch: 8 }, { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, wsUsers, "All Users");

    // Experts sheet
    const expertData = [
      ["Expert ID", "User ID", "Bio", "Expertise", "Credentials", "Rating", "Reviews", "Verified", "Tier", "Rate/min"],
      ...allExperts.map(e => [e.id, e.userId, (e.bio || "").substring(0, 100), e.expertise, e.credentials, (e.rating / 10).toFixed(1), e.totalReviews, e.verified ? "Yes" : "No", e.rateTier || "", e.ratePerMinute || ""]),
    ];
    const wsExperts = XLSX.utils.aoa_to_sheet(expertData);
    wsExperts["!cols"] = [{ wch: 10 }, { wch: 8 }, { wch: 40 }, { wch: 30 }, { wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsExperts, "All Experts");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const today = new Date().toISOString().split('T')[0];

    await resend.emails.send({
      from: "A2A Global <noreply@a2a.global>",
      to: COFOUNDER_EMAILS,
      subject: `📊 A2A Global User Data Report — ${today} (${allUsers.length} users, ${allExperts.length} experts)`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
          <div style="text-align:center;padding:15px;border-bottom:2px solid #0F3DD1;">
            <img src="https://a2a.global/a2a-blue-logo.svg" alt="A2A Global" height="36" />
          </div>
          <h2 style="color:#0F3DD1;margin-top:20px;">Daily User Data Report</h2>
          <table style="width:100%;border-collapse:collapse;margin:15px 0;">
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Total Users</td><td style="padding:8px;border-bottom:1px solid #eee;">${allUsers.length}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Experts</td><td style="padding:8px;border-bottom:1px solid #eee;">${allExperts.length}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Clients</td><td style="padding:8px;border-bottom:1px solid #eee;">${allUsers.length - allExperts.length}</td></tr>
          </table>
          <p style="color:#666;font-size:13px;">Full Excel report attached with all user and expert data.</p>
        </div>
      `,
      attachments: [{
        filename: `A2A_User_Data_${today}.xlsx`,
        content: buffer.toString("base64"),
      }],
    });
    console.log(`[EMAIL] ✅ Full user data email sent (${allUsers.length} users)`);
  } catch (err) {
    console.error("[EMAIL] ❌ Full user data email failed:", err);
  }
}
