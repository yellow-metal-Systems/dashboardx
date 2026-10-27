import { button, esc, layout, type EmailContent } from "@/lib/email";
import { TEMPLATE_TITLES, type AgreementTemplate } from "@/lib/agreements/fields";
import { istTimestamp } from "@/lib/agreements/format";

// The onboarding emails LeadDesk sends. "Application received" goes out from
// LeadBridge (leadbridge lib/email-templates.ts).

const signOff = "<p>Yellow Metal</p>";

export function agreementSent(p: { name: string; template: AgreementTemplate; link: string; expiresAt: Date; resent: boolean }): EmailContent {
  const title = TEMPLATE_TITLES[p.template];
  const expires = istTimestamp(p.expiresAt);
  const intro = p.resent
    ? `Here is a new link to your ${title}. Any link we sent you before no longer works.`
    : `Thank you for applying to become a Yellow Metal partner. Please read your ${title} and sign it online.`;
  return {
    subject: `Please sign your Yellow Metal ${title}`,
    html: layout(
      `Your ${title}`,
      `<p>Hi ${esc(p.name)},</p>
<p>${esc(intro)}</p>
<p>To sign, open the link, read the agreement, type your full name exactly as it appears on it, and tick that you agree.</p>
${button(p.link, "Read and sign the agreement")}
<p>The link works once and expires on <b>${esc(expires)}</b>. Please don't forward this email: anyone with the link can see your agreement.</p>
${signOff}`,
    ),
    text: `Hi ${p.name},

${intro}

To sign, open the link, read the agreement, type your full name exactly as it appears on it, and tick that you agree:
${p.link}

The link works once and expires on ${expires}. Please don't forward this email: anyone with the link can see your agreement.

Yellow Metal`,
  };
}

export function approved(p: { name: string; template: AgreementTemplate; inviteLink: string; inviteDays: number; installLink: string }): EmailContent {
  const title = TEMPLATE_TITLES[p.template];
  return {
    subject: "Welcome to Yellow Metal: set your password",
    html: layout(
      "You're now a Yellow Metal partner",
      `<p>Hi ${esc(p.name)},</p>
<p>Yellow Metal has countersigned your ${esc(title)}. The fully signed copy is attached to this email; please keep it for your records.</p>
<p>Set a password for the partner app to start sending leads. You'll sign in with your mobile number and this password.</p>
${button(p.inviteLink, "Set your password")}
<p>This link works once and expires in ${p.inviteDays} days. To add the app to your phone's home screen, see <a href="${esc(p.installLink)}" style="color:#1f3a5f">${esc(p.installLink)}</a>.</p>
${signOff}`,
    ),
    text: `Hi ${p.name},

Yellow Metal has countersigned your ${title}. The fully signed copy is attached to this email; please keep it for your records.

Set a password for the partner app to start sending leads. You'll sign in with your mobile number and this password:
${p.inviteLink}

This link works once and expires in ${p.inviteDays} days. To add the app to your phone's home screen, see ${p.installLink}

Yellow Metal`,
  };
}

export function rejected(p: { name: string; reason: string }): EmailContent {
  return {
    subject: "About your Yellow Metal partner application",
    html: layout(
      "About your application",
      `<p>Hi ${esc(p.name)},</p>
<p>Thank you for your interest in becoming a Yellow Metal partner. We're unable to go ahead with your application at this time.</p>
<p><b>Reason:</b> ${esc(p.reason)}</p>
<p>You're welcome to apply again later.</p>
${signOff}`,
    ),
    text: `Hi ${p.name},

Thank you for your interest in becoming a Yellow Metal partner. We're unable to go ahead with your application at this time.

Reason: ${p.reason}

You're welcome to apply again later.

Yellow Metal`,
  };
}
