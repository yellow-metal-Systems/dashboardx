import Link from "next/link";
import { notFound } from "next/navigation";

import { EmailStatus } from "@/components/email-status";
import { Card, CardContent } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { listEmails } from "@/lib/email-log";
import { formatDateTime } from "@/lib/leads";

// Sent emails (plan of 27 Oct 2026, B5): every onboarding email LeadDesk and
// LeadBridge sent. In log mode (no mail service yet) this is the demo mailbox:
// open an email to read it and follow its links. Admins only (partners.manage).
export const dynamic = "force-dynamic";

export const metadata = { title: "Sent emails" };

export default async function EmailsPage() {
  await requirePermission("partners.manage");
  const { mode, emails } = await listEmails();
  // Demo mailbox only (plan B5): once emails really go out, failures show on each application's history instead.
  if (mode !== "log") notFound();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      <div>
        <h1 className="text-heading-lg text-on-surface">Sent emails</h1>
        <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
          Demo mode: emails are saved here instead of being sent. Open one to read it and follow its links.
          {emails.length === 100 && " Showing the latest 100."}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 md:pt-9">
          {emails.length === 0 ? (
            <p className="py-10 text-center text-sm text-on-surface-variant">No emails yet. The first one goes out when someone applies on LeadBridge.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="[&>th]:whitespace-nowrap">
                  <TableHead>Email</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((e) => (
                  <TableRow key={e.id} className="relative">
                    <TableCell className="text-on-surface">
                      <Link href={`/dashboard/emails/${e.id}`} className="after:absolute after:inset-0 hover:underline">
                        {e.subject}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-semibold text-on-surface-variant">{e.toAddress}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <EmailStatus status={e.status} />
                      {e.error && <span className="mt-1 block text-xs text-error">{e.error}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums font-semibold text-on-surface-variant">{formatDateTime(e.createdAt.toISOString())}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
