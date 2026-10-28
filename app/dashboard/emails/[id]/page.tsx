import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { EmailStatus } from "@/components/email-status";
import { CopyField } from "@/components/partners/copy-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { requirePermission } from "@/lib/auth/session";
import { emailMode } from "@/lib/email";
import { getEmail } from "@/lib/email-log";
import { formatDateTime } from "@/lib/leads";

// One email (plan B5). A logged (demo) email shows its body and its links, so a
// demo can follow the signing or set-password link without a mail service. The
// body is our own template, still shown in a sandboxed frame: no scripts, no
// access to LeadDesk; links open in a new tab.
export const dynamic = "force-dynamic";

/** The http(s) links in an email body, in order, without repeats. esc() writes &amp; &quot; &#39; into hrefs. */
function linksIn(html: string): string[] {
  const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return Array.from(new Set(Array.from(html.matchAll(/href="(https?:\/\/[^"]+)"/g), (m) => unescape(m[1]))));
}

/** Links open in a new tab; the <base> goes in <head> so the email keeps its doctype (no quirks mode). */
const withNewTabLinks = (html: string) =>
  /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (head) => `${head}<base target="_blank">`) : `<base target="_blank">${html}`;

const NO_BODY: Record<string, string> = {
  SENT: "This email went out through Resend, so its text isn't stored.",
  FAILED: "This email was not delivered (see the error above), and its text isn't stored.",
};

export default async function EmailPage({ params }: { params: { id: string } }) {
  await requirePermission("partners.manage");
  // Demo mailbox only (plan B5). Once real email is on, old demo bodies hold live links nobody should reuse.
  if (emailMode() !== "log") notFound();
  const email = await getEmail(params.id);
  if (!email) notFound();
  const body = email.bodyHtml;
  const links = body ? linksIn(body) : [];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      <Link href="/dashboard/emails" className="flex w-fit items-center gap-1 text-sm text-on-surface-variant hover:underline">
        <ChevronLeft className="size-4" /> Sent emails
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-heading-lg text-on-surface">{email.subject}</h1>
          <EmailStatus status={email.status} />
        </div>
        <p className="text-sm text-on-surface-variant">
          To {email.toAddress} · {formatDateTime(email.createdAt.toISOString())}
          {email.applicationId && (
            <>
              {" · "}
              <Link href={`/dashboard/partners/applications/${email.applicationId}`} className="font-semibold text-link hover:underline">
                Open the application
              </Link>
            </>
          )}
        </p>
      </div>
      {email.error && <p role="alert" className="text-sm font-medium text-error">{email.error}</p>}

      {body ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <iframe
            title={`Email: ${email.subject}`}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={withNewTabLinks(body)}
            className="h-[640px] w-full rounded-lg border border-outline-variant bg-white"
          />
          {links.length > 0 && (
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Links in this email</CardTitle>
                <p className="text-sm text-on-surface-variant">Copy one to open it on a phone.</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {links.map((href, i) => (
                  <CopyField key={href} value={href} label={`Link ${i + 1} in this email`} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant">
          {NO_BODY[email.status] ?? "This email's text wasn't saved."}
        </p>
      )}
    </div>
  );
}
