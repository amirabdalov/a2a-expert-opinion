import { Resend } from "resend";
const resend = new Resend("re_PrjaSqsY_fdEew3xntXPQsouj46kysKRF");

export interface InvoiceEmailData {
  invoiceNumber: string;
  expertName: string;
  netPayoutCents: number;
  totalAmountCents: number;
  lineItems: Array<{ title: string; amountCents: number }>;
  createdAt: string;
}

export async function sendInvoiceEmail(to: string, data: InvoiceEmailData) {
  const { invoiceNumber, expertName, netPayoutCents, lineItems, createdAt } = data;
  const payoutDollars = (netPayoutCents / 100).toFixed(2);
  const lineItemRows = lineItems
    .map(
      (item) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;">${item.title}</td><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right;">$${(item.amountCents / 100).toFixed(2)}</td></tr>`
    )
    .join("");

  return resend.emails.send({
    from: "A2A Global <noreply@a2a.global>",
    to,
    subject: `Invoice ${invoiceNumber} — $${payoutDollars} payout`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
      <div style="text-align:center;padding:20px;border-bottom:2px solid #0F3DD1;">
        <img src="https://a2a.global/a2a-blue-logo.svg" alt="A2A Global" height="40" style="height:40px;display:block;margin:0 auto;" />
      </div>
      <div style="padding:24px 0;">
        <h2 style="color:#0F3DD1;margin:0 0 8px;">Invoice ${invoiceNumber}</h2>
        <p>Hi ${expertName},</p>
        <p>Your invoice has been generated. Here is a summary:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <thead><tr><th style="text-align:left;padding:6px 0;border-bottom:2px solid #0F3DD1;">Service</th><th style="text-align:right;padding:6px 0;border-bottom:2px solid #0F3DD1;">Amount</th></tr></thead>
          <tbody>${lineItemRows}</tbody>
          <tfoot><tr><td style="padding:10px 0;font-weight:700;">Total Payout</td><td style="padding:10px 0;font-weight:700;text-align:right;color:#0F3DD1;">$${payoutDollars}</td></tr></tfoot>
        </table>
        <p style="color:#6b7280;font-size:13px;">Invoice date: ${new Date(createdAt).toLocaleDateString()}</p>
        <p style="color:#6b7280;font-size:13px;">Payments are processed within 3-5 business days after approval.</p>
      </div>
      <div style="border-top:1px solid #eee;padding:16px 0;text-align:center;">
        <p style="font-size:11px;color:#9ca3af;">Connecting businesses with AI experts worldwide.</p>
        <p style="font-size:10px;color:#9ca3af;">&copy; 2026 A2A Global Inc. File No. 10050200, Newark, Delaware.</p>
      </div>
    </div>`,
  });
}

export async function sendVerificationEmail(expertName: string, requestTitle: string) {
  const recipients = ["oleg@a2a.global", "amir@a2a.global"];
  return resend.emails.send({
    from: "A2A Global <noreply@a2a.global>",
    to: recipients,
    subject: `A2A Global — Expert Response Needs Verification`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
      <div style="text-align:center;padding:20px;border-bottom:2px solid #0F3DD1;">
        <img src="https://a2a.global/a2a-blue-logo.svg" alt="A2A Global" height="40" style="height:40px;display:block;margin:0 auto;" />
      </div>
      <div style="padding:24px 0;">
        <h2 style="color:#0F3DD1;margin:0 0 8px;">New Response Needs Verification</h2>
        <p>Expert <strong>${expertName}</strong> submitted a response for request <strong>'${requestTitle}'</strong>.</p>
        <p>Please review in the admin panel.</p>
        <div style="margin:24px 0;">
          <a href="https://a2a.global/admin" style="background:#0F3DD1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Open Admin Panel</a>
        </div>
      </div>
      <div style="border-top:1px solid #eee;padding:16px 0;text-align:center;">
        <p style="font-size:11px;color:#9ca3af;">Connecting businesses with AI experts worldwide.</p>
        <p style="font-size:10px;color:#9ca3af;">&copy; 2026 A2A Global Inc. File No. 10050200, Newark, Delaware.</p>
      </div>
    </div>`,
  });
}

export async function sendOtpEmail(to: string, name: string, otp: string) {
  return resend.emails.send({
    from: "A2A Global <noreply@a2a.global>",
    to,
    subject: `Your A2A Global verification code — ${otp}`,
    html: `<div style="font-family:sans-serif;max-width:460px;margin:0 auto;padding:20px;">
      <div style="text-align:center;padding:20px;border-bottom:2px solid #0F3DD1;">
        <img src="https://a2a.global/a2a-blue-logo.svg" alt="A2A Global" height="40" style="height:40px;display:block;margin:0 auto;" />
      </div>
      <div style="padding:24px 0;">
        <p>Hi ${name},</p>
        <p>Your verification code:</p>
        <div style="background:#f0f4ff;border:1px solid #d4deff;border-radius:8px;padding:20px;text-align:center;margin:16px 0;">
          <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0F3DD1;font-family:monospace;">${otp}</span>
        </div>
        <p style="color:#6b7280;font-size:13px;">Expires in 10 minutes.</p>
      </div>
      <div style="border-top:1px solid #eee;padding:16px 0;text-align:center;">
        <p style="font-size:11px;color:#9ca3af;">Connecting businesses with AI experts worldwide.</p>
        <p style="font-size:10px;color:#9ca3af;">© 2026 A2A Global Inc. File No. 10050200, Newark, Delaware.</p>
      </div>
    </div>`
  });
}
