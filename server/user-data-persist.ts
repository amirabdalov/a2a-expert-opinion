import XLSX from "xlsx";
import { Resend } from "resend";
import pg from "pg";

const resend = new Resend("re_PrjaSqsY_fdEew3xntXPQsouj46kysKRF");
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
  try {
    pgPool = new pg.Pool({ ...PG_CONFIG, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
    // Test connection
    const client = await pgPool.connect();
    client.release();
    pgReady = true;
    console.log("[CLOUD-SQL] ✅ Connected to PostgreSQL");
    return pgPool;
  } catch (err) {
    console.log("[CLOUD-SQL] Not available (local dev or no Cloud SQL proxy):", (err as Error).message?.substring(0, 80));
    pgPool = null;
    pgReady = false;
    return null;
  }
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
