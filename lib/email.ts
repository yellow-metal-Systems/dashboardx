import { prisma } from "@/lib/prisma";

// =============================================================================
// Outgoing email (partner onboarding, plan of 27 Oct 2026). The same module
// lives in LeadBridge (leadbridge lib/email.ts); keep the two in step.
//
// EMAIL_MODE=log (the default): nothing is sent. Each email is saved to
// email_messages with its body, and LeadDesk's "Sent emails" page shows it, so
// the whole flow can be demoed without a mail service or a domain.
// EMAIL_MODE=resend: sent through Resend's HTTP API (free: 3,000 a month) from
// EMAIL_FROM on Yellow Metal's domain. The body is NOT stored, so signing and
// password links never sit in the database.
//
// sendEmail never throws for a delivery problem: the caller's action (an
// application, an approval) must not fail because an email did. The row says
// FAILED and the error, and the caller can log an event.
// =============================================================================

export type EmailContent = { subject: string; html: string; text: string };
export type EmailAttachment = { filename: string; content: Buffer };
export type SendEmailInput = EmailContent & {
  to: string;
  /** e.g. application_received, agreement_sent, approved, rejected */
  template: string;
  applicationId?: string | null;
  attachments?: EmailAttachment[];
};
export type SendResult = { id: string; status: "LOGGED" | "SENT" | "FAILED"; error?: string };

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export function emailMode(): "log" | "resend" {
  return process.env.EMAIL_MODE?.trim().toLowerCase() === "resend" ? "resend" : "log";
}

/** Escapes text for an HTML email body. */
export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendEmail(input: SendEmailInput, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const base = { toAddress: input.to, template: input.template, subject: input.subject, applicationId: input.applicationId ?? null };

  if (emailMode() === "log") {
    const files = input.attachments?.length
      ? `<hr><p>Attachments: ${input.attachments.map((a) => `${esc(a.filename)} (${a.content.length} bytes)`).join(", ")}</p>`
      : "";
    const row = await prisma.emailMessage.create({ data: { ...base, status: "LOGGED", bodyHtml: input.html + files } });
    return { id: row.id, status: "LOGGED" };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  let error: string | undefined;
  let providerId: string | null = null;
  if (!apiKey || !from) {
    error = "EMAIL_MODE is resend but RESEND_API_KEY or EMAIL_FROM is not set.";
  } else {
    try {
      const res = await fetchImpl(RESEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (res.ok && body.id) providerId = body.id;
      else error = `Resend refused the email (HTTP ${res.status}): ${body.message ?? "no message"}`;
    } catch (err) {
      error = `Resend could not be reached: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  if (error) console.error(`[email] ${input.template} not sent: ${error}`);
  const row = await prisma.emailMessage.create({
    data: {
      ...base,
      status: error ? "FAILED" : "SENT",
      providerMessageId: providerId,
      error: error ?? null,
      sentAt: error ? null : new Date(),
    },
  });
  return { id: row.id, status: error ? "FAILED" : "SENT", ...(error ? { error } : {}) };
}

/** A plain, readable email: the brand line, the message, a footer. Inline styles only. */
export function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#1a202c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0">
<tr><td style="padding:20px 24px 0;font-size:13px;font-weight:bold;letter-spacing:.06em;color:#8a5a00;text-transform:uppercase">Yellow Metal</td></tr>
<tr><td style="padding:8px 24px 0;font-size:20px;font-weight:bold">${esc(title)}</td></tr>
<tr><td style="padding:12px 24px 24px;font-size:15px;line-height:1.55">${bodyHtml}</td></tr>
</table>
<p style="font-size:12px;color:#718096;margin:16px 0 0">You are receiving this because you applied to become a Yellow Metal partner.</p>
</td></tr></table></body></html>`;
}

/** A button-style link, with the URL also written out for clients that strip buttons. */
export function button(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${esc(href)}" style="background:#1f3a5f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:bold">${esc(label)}</a></p>
<p style="font-size:13px;color:#4a5568">Or open this link: <a href="${esc(href)}" style="color:#1f3a5f;word-break:break-all">${esc(href)}</a></p>`;
}
