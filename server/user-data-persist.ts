import XLSX from "xlsx";
import { Resend } from "resend";

const resend = new Resend("re_PrjaSqsY_fdEew3xntXPQsouj46kysKRF");
const COFOUNDER_EMAILS = ["amir@a2a.global", "oleg@a2a.global"];

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
