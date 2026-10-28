import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddPartnerDialog } from "@/components/partners/add-partner-dialog";
import { requirePermission } from "@/lib/auth/session";
import { PARTNER_STATUS_BADGE_CLASSES, formatDate, formatDateTime } from "@/lib/leads";
import { listPartners } from "@/lib/partners/onboarding";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  countApplications,
  listApplications,
  type ApplicationStatus,
} from "@/lib/partners/applications";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { invited: "Invited", active: "Active", disabled: "Turned off" };
const APPLICATION_LABEL = APPLICATION_STATUS_LABELS;
/** The column after "Applied", by tab: what the admin is waiting on, or who reviewed it. */
const LAST_COLUMN: Partial<Record<ApplicationStatus, string>> = {
  AGREEMENT_SENT: "Signing link",
  SIGNED: "Signed",
  APPROVED: "Reviewed",
  REJECTED: "Reviewed",
};

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-bold",
        active ? "bg-raised shadow-e1" : "text-on-surface-variant"
      )}
    >
      {children}
    </Link>
  );
}

export default async function PartnersPage({ searchParams }: { searchParams: { tab?: string; status?: string } }) {
  await requirePermission("partners.view");
  const onApplications = searchParams.tab === "applications";
  const appStatus: ApplicationStatus = (APPLICATION_STATUSES as readonly string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as ApplicationStatus)
    : "PENDING";

  const [partners, counts, applications] = await Promise.all([
    onApplications ? null : listPartners(),
    countApplications(),
    onApplications ? listApplications(appStatus) : null,
  ]);
  // Waiting on an admin: new applications to send, and signed ones to countersign.
  const pendingCount = counts.PENDING + counts.SIGNED;
  const now = new Date();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading-lg text-on-surface">Partners</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Lead generators and organisations who send leads through LeadBridge
            {partners && ` · ${partners.length} total`}
          </p>
        </div>
        <AddPartnerDialog />
      </div>

      <nav aria-label="Partners sections" className="flex w-fit gap-1 rounded-full bg-surface-container-low p-1">
        <Tab href="/dashboard/partners" active={!onApplications}>Partners</Tab>
        <Tab href="/dashboard/partners?tab=applications" active={onApplications}>
          Applications
          {pendingCount > 0 && (
            <Badge variant="pending" data-pending-applications>{pendingCount}</Badge>
          )}
        </Tab>
      </nav>

      {applications ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 md:pt-9">
            <nav aria-label="Application status" className="flex flex-wrap gap-1">
              {APPLICATION_STATUSES.map((s) => (
                <Tab key={s} href={`/dashboard/partners?tab=applications&status=${s}`} active={s === appStatus}>
                  {APPLICATION_LABEL[s]}
                  <span className="font-normal tabular-nums text-on-surface-variant">{counts[s]}</span>
                </Tab>
              ))}
            </nav>

            {applications.length === 0 ? (
              <p className="py-10 text-center text-sm text-on-surface-variant">
                {appStatus === "PENDING"
                  ? "No applications waiting. New partners apply on LeadBridge's /join page."
                  : `No ${APPLICATION_LABEL[appStatus].toLowerCase()} applications.`}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="[&>th]:whitespace-nowrap">
                    <TableHead>Applicant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Town</TableHead>
                    <TableHead>Applied</TableHead>
                    {LAST_COLUMN[appStatus] && <TableHead>{LAST_COLUMN[appStatus]}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((a) => (
                    <TableRow key={a.id} className="relative">
                      <TableCell className="font-medium text-on-surface">
                        {/* The whole row opens the application, where every action lives. */}
                        <Link href={`/dashboard/partners/applications/${a.id}`} className="after:absolute after:inset-0 hover:underline">
                          {a.companyName ?? a.name}
                        </Link>
                        <span className="block text-xs font-normal text-on-surface-variant">
                          {a.companyName ? `${a.name} · ` : ""}
                          {a.mobile}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{a.applicantType === "COMPANY" ? "Company · DSA" : "Individual · BC"}</TableCell>
                      <TableCell>{a.town}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(a.createdAt.toISOString())}</TableCell>
                      {appStatus === "AGREEMENT_SENT" && (
                        <TableCell className="whitespace-nowrap">
                          {a.linkExpiresAt && a.linkExpiresAt <= now ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : (
                            a.linkExpiresAt && `Until ${formatDate(a.linkExpiresAt.toISOString())}`
                          )}
                        </TableCell>
                      )}
                      {appStatus === "SIGNED" && (
                        <TableCell className="whitespace-nowrap">{a.signedAt && formatDateTime(a.signedAt.toISOString())}</TableCell>
                      )}
                      {(appStatus === "APPROVED" || appStatus === "REJECTED") && (
                        <TableCell className="text-sm">
                          {a.reviewedAt && formatDate(a.reviewedAt.toISOString())}
                          {a.reviewedBy && <span className="text-on-surface-variant"> by {a.reviewedBy}</span>}
                          {a.rejectReason && <span className="block text-xs text-on-surface-variant">“{a.rejectReason}”</span>}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 md:pt-9">
            {partners!.length === 0 ? (
              <p className="py-10 text-center text-sm text-on-surface-variant">
                No partners yet. Add the first one — they get an invite link to set a password.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="[&>th]:whitespace-nowrap">
                    <TableHead>Partner</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead>API keys</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners!.map((p) => (
                    <TableRow key={p.id} className="relative">
                      <TableCell className="whitespace-nowrap font-medium text-on-surface">
                        <Link href={`/dashboard/partners/${p.id}`} className="after:absolute after:inset-0 hover:underline">
                          {p.orgName}
                        </Link>
                        <span className="block text-xs text-on-surface-variant">{p.contactEmail}</span>
                      </TableCell>
                      <TableCell>{p.type === "ORGANISATION" ? "Organisation" : "Individual"}{p.isOndc ? " · ONDC" : ""}</TableCell>
                      <TableCell>
                        <Badge className={cn("border-transparent", PARTNER_STATUS_BADGE_CLASSES[p.status])}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                      </TableCell>
                      <TableCell>{p.users.length}</TableCell>
                      <TableCell className="text-right tabular-nums">{p._count.leads}</TableCell>
                      <TableCell>{p.apiKeys.filter((k) => !k.revokedAt).length || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(p.createdAt.toISOString())}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
