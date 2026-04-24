import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { verifyAuth, requireAdmin } from "@/lib/server/verify-auth";
import { adminDb } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "DeskHive Support <onboarding@resend.dev>";

// Simple per-IP rate limiter for the public ticket_submitted path.
// Not persistent across serverless cold-starts — good enough as a first line
// of defence; pair with Firebase App Check for real protection.
const submitHits = new Map<string, { count: number; resetAt: number }>();
const SUBMIT_WINDOW_MS = 60_000; // 1 minute
const SUBMIT_MAX = 5;            // 5 confirmation emails per IP per minute

function checkSubmitRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = submitHits.get(ip);
  if (!entry || entry.resetAt < now) {
    submitHits.set(ip, { count: 1, resetAt: now + SUBMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= SUBMIT_MAX) return false;
  entry.count++;
  return true;
}

// Basic input validation helpers
function isString(v: unknown, max = 1000): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}
function isEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

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
              ⚡ DeskHive Support
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            ${content}
            <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e5e7eb;
               font-size:11px;color:#9ca3af;line-height:1.5">
              This message was sent by DeskHive Support. Please quote your reference number
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
      Thank you for contacting DeskHive Support. A member of our team will review your
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

function agentInviteHtml(invitedBy: string, appUrl: string, agentEmail: string) {
  return baseHtml(`
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1c1c;letter-spacing:-0.4px">
      You've been invited to DeskHive
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#48484a;line-height:1.7">
      <strong>${escHtml(invitedBy)}</strong> has invited you to join DeskHive Support CRM as an agent.
    </p>
    <div style="background:#f8f7ff;border-radius:12px;padding:18px 22px;margin-bottom:22px">
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#1a1c1c;">To get started:</p>
      <p style="margin:0 0 8px;font-size:14px;color:#48484a">1. Visit the app:</p>
      <a href="${escHtml(appUrl)}" style="display:inline-block;background:linear-gradient(135deg,#7131d6,#0058bf);
         color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:10px;
         font-size:14px;font-weight:600;margin-bottom:12px">${escHtml(appUrl)}</a>
      <p style="margin:8px 0 4px;font-size:14px;color:#48484a">2. Click <strong>"Sign in with Google"</strong></p>
      <p style="margin:4px 0 0;font-size:14px;color:#48484a">3. Sign in using: <strong>${escHtml(agentEmail)}</strong></p>
    </div>
    <p style="margin:0;font-size:13px;color:#48484a;line-height:1.7">
      You'll have immediate access once you sign in. If you have any issues, contact your admin.
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
    const body = await req.json();
    const { type, to, ticketId, customerName, agentMessage, issueType, invitedBy, appUrl } = body;

    if (!isEmail(to)) {
      return NextResponse.json({ error: "Invalid 'to' address" }, { status: 400 });
    }
    if (!isString(type, 40)) {
      return NextResponse.json({ error: "Missing 'type'" }, { status: 400 });
    }

    // ── Authorize per email type ───────────────────────────────────────────
    // ticket_submitted is the only public path (customer confirmation after
    // submitting a ticket). Everything else is an agent/admin action.

    let subject: string;
    let html: string;

    switch (type) {
      case "ticket_submitted": {
        // Rate limit by IP
        const ip =
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          "unknown";
        if (!checkSubmitRateLimit(ip)) {
          return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
        }
        // Validate required fields
        if (!isString(ticketId, 80) || !isString(customerName, 120)) {
          return NextResponse.json({ error: "Invalid submission fields" }, { status: 400 });
        }
        // Verify the ticket actually exists and the email matches — prevents
        // using this endpoint to spray arbitrary confirmations.
        const snap = await adminDb().doc(`tickets/${ticketId}`).get();
        if (!snap.exists) {
          return NextResponse.json({ error: "Unknown ticket" }, { status: 404 });
        }
        const ticket = snap.data() as { email?: string; customerEmail?: string } | undefined;
        const ticketEmail = (ticket?.email ?? ticket?.customerEmail ?? "").toLowerCase();
        if (!ticketEmail || ticketEmail !== to.toLowerCase()) {
          return NextResponse.json({ error: "Email does not match ticket" }, { status: 403 });
        }
        subject = `Your support request has been received [${ticketId}]`;
        html = ticketSubmittedHtml(customerName, ticketId, issueType ?? "General");
        break;
      }
      case "ticket_resolved": {
        await verifyAuth(req);
        if (!isString(ticketId, 80) || !isString(customerName, 120)) {
          return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
        }
        subject = `Your ticket has been resolved [${ticketId}]`;
        html = ticketResolvedHtml(customerName, ticketId);
        break;
      }
      case "agent_reply": {
        await verifyAuth(req);
        if (!isString(ticketId, 80) || !isString(customerName, 120) || !isString(agentMessage, 10_000)) {
          return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
        }
        subject = `Message from DeskHive Support [${ticketId}]`;
        html = agentReplyHtml(customerName, ticketId, agentMessage);
        break;
      }
      case "agent_invite": {
        await requireAdmin(req);
        if (!isString(invitedBy, 200) || !isString(appUrl, 500)) {
          return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
        }
        subject = `You've been invited to DeskHive CRM`;
        html = agentInviteHtml(invitedBy, appUrl, to);
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown email type" }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({ from: FROM, to: [to], subject, html });
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ id: data?.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/Authorization|verify|token|admin role/i.test(message)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Email send failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
