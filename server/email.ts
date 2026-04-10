import { Resend } from "resend";
const resend = new Resend("re_PrjaSqsY_fdEew3xntXPQsouj46kysKRF");

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
