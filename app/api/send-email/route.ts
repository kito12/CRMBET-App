import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "PremierBet Support <onboarding@resend.dev>";

// ── HTML email templates ──────────────────────────────────────────────────────

function baseHtml(content: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f4ff">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:linear-gradient(135deg,#7131d6,#0058bf);padding:24px 32px">
            <h1 style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">
              ⚡ PremierBet Support
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            ${content}
            <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e5e7eb;
               font-size:11px;color:#9ca3af;line-height:1.5">
              This message was sent by PremierBet Support. Please quote your reference number
              in any further correspondence.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ticketSubmittedHtml(name: string, ticketId: string, issueType: string) {
  return baseHtml(`
    <p style="margin:0 0 6px;font-size:14px;color:#48484a">Hi ${escHtml(name)},</p>
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1c1c;letter-spacing:-0.4px">
      We've received your request
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#48484a;line-height:1.7">
      Thank you for contacting PremierBet Support. A member of our team will review your
      case and get back to you as soon as possible.
    </p>
    <div style="background:#f8f7ff;border-radius:12px;padding:18px 22px;margin-bottom:22px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#7131d6;
         text-transform:uppercase;letter-spacing:0.08em">Your reference number</p>
      <p style="margin:0 0 6px;font-size:24px;font-weight:700;color:#7131d6;font-family:monospace">
        ${escHtml(ticketId)}
      </p>
      <p style="margin:0;font-size:12px;color:#48484a">Issue type: ${escHtml(issueType)}</p>
    </div>
    <p style="margin:0;font-size:14px;color:#48484a;line-height:1.7">
      Please save your reference number for any future correspondence with our team.
      We typically respond within 2–4 hours.
    </p>
  `);
}

function ticketResolvedHtml(name: string, ticketId: string) {
  return baseHtml(`
    <p style="margin:0 0 6px;font-size:14px;color:#48484a">Hi ${escHtml(name)},</p>
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1c1c;letter-spacing:-0.4px">
      Your ticket has been resolved
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#48484a;line-height:1.7">
      Our support team has resolved your ticket. If you are still experiencing issues
      or have any further questions, please don't hesitate to submit a new request.
    </p>
    <div style="background:#f0fdf4;border-radius:12px;padding:18px 22px;margin-bottom:22px;
         border-left:4px solid #22c55e">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#16a34a;
         text-transform:uppercase;letter-spacing:0.08em">✓ Resolved</p>
      <p style="margin:0;font-size:20px;font-weight:700;color:#1a1c1c;font-family:monospace">
        ${escHtml(ticketId)}
      </p>
    </div>
    <p style="margin:0;font-size:14px;color:#48484a;line-height:1.7">
      Thank you for your patience. We hope your issue has been fully resolved.
    </p>
  `);
}

function agentReplyHtml(name: string, ticketId: string, message: string) {
  return baseHtml(`
    <p style="margin:0 0 6px;font-size:14px;color:#48484a">Hi ${escHtml(name)},</p>
    <h2 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#1a1c1c;letter-spacing:-0.4px">
      You have a new message
    </h2>
    <p style="margin:0 0 20px;font-size:12px;color:#7131d6;font-family:monospace;font-weight:600">
      Ref: ${escHtml(ticketId)}
    </p>
    <div style="background:#f8f7ff;border-radius:12px;padding:20px 22px;margin-bottom:22px;
         border-left:4px solid #7131d6">
      <p style="margin:0;font-size:14px;color:#1a1c1c;line-height:1.75;white-space:pre-wrap">
        ${escHtml(message)}
      </p>
    </div>
    <p style="margin:0;font-size:14px;color:#48484a;line-height:1.7">
      If you have further questions, please submit a new support request and quote
      your reference number.
    </p>
  `);
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!resend) {
    return NextResponse.json(
      { error: "Email not configured — add RESEND_API_KEY to .env.local" },
      { status: 503 }
    );
  }

  try {
    const { type, to, ticketId, customerName, agentMessage, issueType } = await req.json();

    if (!to || !ticketId || !customerName) {
      return NextResponse.json({ error: "Missing required fields: to, ticketId, customerName" }, { status: 400 });
    }

    let subject: string;
    let html: string;

    switch (type) {
      case "ticket_submitted":
        subject = `Your support request has been received [${ticketId}]`;
        html = ticketSubmittedHtml(customerName, ticketId, issueType ?? "General");
        break;
      case "ticket_resolved":
        subject = `Your ticket has been resolved [${ticketId}]`;
        html = ticketResolvedHtml(customerName, ticketId);
        break;
      case "agent_reply":
        subject = `Message from PremierBet Support [${ticketId}]`;
        html = agentReplyHtml(customerName, ticketId, agentMessage ?? "");
        break;
      default:
        return NextResponse.json({ error: "Unknown email type" }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({ from: FROM, to: [to], subject, html });
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ id: data?.id });
  } catch (err) {
    console.error("Email send failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
