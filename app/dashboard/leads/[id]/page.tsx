import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";

import { LeadStatusSelect } from "@/components/leads/lead-status-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  ACCEPTANCE_LABELS,
  BRANCH_MANAGER_BADGE_CLASSES,
  BRANCH_MANAGER_LABELS,
  SOURCE_LABELS,
  formatDate,
  formatDateTime,
  formatInr,
  leadRef,
} from "@/lib/leads";
import { getLeadDetail } from "@/lib/leads-repo";

export const dynamic = "force-dynamic";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-label-sm uppercase tracking-widest text-label">
      {children}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0">
      <dt className="text-paragraph-md text-info-label">{label}</dt>
      <dd className="text-[18px] font-bold leading-6 text-on-surface">{children}</dd>
    </div>
  );
}

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
});

export default async function LeadPage({ params }: { params: { id: string } }) {
  const detail = await getLeadDetail(params.id);
  if (!detail) notFound();
  const { lead, activities, duplicates } = detail;

  const ref = leadRef(lead);
  const isAarthik = lead.source === "AARTHIKLABS";
  const submitter = lead.partner?.orgName ?? SOURCE_LABELS[lead.source];
  const firstDuplicate = duplicates[0];
  const kfsIsUrl = lead.kfsReference?.startsWith("http") ?? false;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Link
          href="/dashboard"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
          aria-label="Back to leads"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <nav aria-label="Breadcrumb" className="text-xs text-on-surface-variant">
          <Link href="/dashboard" className="hover:underline">
            Leads
          </Link>
          <span className="mx-1.5">/</span>
          <span className="font-medium text-on-surface">{ref}</span>
        </nav>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-heading-lg text-on-surface">{lead.name}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Submitted {formatDateTime(lead.createdAt)} by {submitter}
          </p>
        </div>
        {lead.duplicateFlag && (
          <Badge className="gap-1.5 self-start border-transparent bg-secondary-container px-3 py-1 text-on-secondary-container hover:bg-secondary-container">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {firstDuplicate
              ? `Duplicate — matches lead ${leadRef(firstDuplicate)}`
              : "Flagged as duplicate"}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6 md:pt-9">
              <SectionTitle>Borrower details</SectionTitle>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">{lead.name}</Field>
                <Field label="Mobile number">{lead.mobile}</Field>
                <Field label="Address">{lead.address}</Field>
                <Field label="Pincode">{lead.pinCode}</Field>
                {lead.dob && <Field label="Date of birth">{formatDate(lead.dob)}</Field>}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 pt-6 md:pt-9">
              <SectionTitle>{isAarthik ? "Loan offer" : "Loan request"}</SectionTitle>
              <dl className="grid gap-4 sm:grid-cols-2">
                {!isAarthik && lead.loanAmount !== null && (
                  <Field label="Required amount">
                    <span className="text-lg font-semibold">{formatInr(lead.loanAmount)}</span>
                  </Field>
                )}
                {!isAarthik && <Field label="Submitting partner">{submitter}</Field>}
                {isAarthik && lead.offerAmount !== null && (
                  <Field label="Offer amount">
                    <span className="text-lg font-semibold">{formatInr(lead.offerAmount)}</span>
                  </Field>
                )}
                {isAarthik && lead.goldGrams !== null && (
                  <Field label="Gold">{lead.goldGrams} g</Field>
                )}
                {isAarthik && lead.ltvPercent !== null && (
                  <Field label="LTV">{lead.ltvPercent}%</Field>
                )}
                {isAarthik && (
                  <Field label="Offer acceptance">
                    {ACCEPTANCE_LABELS[lead.acceptanceState]}
                  </Field>
                )}
                {lead.kfsReference && (
                  <Field label="Key Fact Statement">
                    {kfsIsUrl ? (
                      <a
                        href={lead.kfsReference}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                      >
                        Open KFS <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="font-mono text-xs">{lead.kfsReference}</span>
                    )}
                  </Field>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 pt-6 md:pt-9">
              <SectionTitle>Activity</SectionTitle>
              {activities.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No activity recorded.</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {activities.map((a) => (
                    <li key={a.id} className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
                      <time
                        dateTime={a.createdAt}
                        title={formatDateTime(a.createdAt)}
                        className="text-on-surface-variant"
                      >
                        {formatDate(a.createdAt)},{" "}
                        {timeFormatter.format(new Date(a.createdAt))}
                      </time>
                      <span className="text-on-surface">
                        {a.message}
                        {a.actor && (
                          <span className="text-on-surface-variant"> by {a.actor}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6 md:pt-9">
              <SectionTitle>Status</SectionTitle>
              <LeadStatusSelect
                leadId={lead.id}
                leadName={lead.name}
                status={lead.status}
                className="w-full"
              />
            </CardContent>
          </Card>

          {lead.duplicateFlag && (
            <Card>
              <CardContent className="flex flex-col gap-3 pt-6 md:pt-9">
                <SectionTitle>Duplicate check</SectionTitle>
                {firstDuplicate ? (
                  <>
                    <p className="text-sm text-on-surface-variant">
                      This mobile number matches an earlier lead submitted by{" "}
                      <span className="font-medium text-on-surface">
                        {firstDuplicate.partner?.orgName ??
                          SOURCE_LABELS[firstDuplicate.source]}
                      </span>{" "}
                      on {formatDate(firstDuplicate.createdAt)}.
                    </p>
                    <ul className="flex flex-col gap-1">
                      {duplicates.map((d) => (
                        <li key={d.id}>
                          <Link
                            href={`/dashboard/leads/${d.id}`}
                            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                          >
                            View matching lead {leadRef(d)} →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-on-surface-variant">
                    Flagged as duplicate, but no other lead with this mobile number
                    is in the system.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {lead.partner ? (
            <Card>
              <CardContent className="flex flex-col gap-2 pt-6 md:pt-9">
                <SectionTitle>Partner</SectionTitle>
                <p className="text-sm font-medium text-on-surface">{lead.partner.orgName}</p>
                <a
                  href={`mailto:${lead.partner.contactEmail}`}
                  className="text-xs text-on-surface-variant hover:underline"
                >
                  {lead.partner.contactEmail}
                </a>
                <Link
                  href="/dashboard/partners"
                  className="mt-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  View partner →
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col gap-2 pt-6 md:pt-9">
                <SectionTitle>Source</SectionTitle>
                <p className="text-sm font-medium text-on-surface">
                  {SOURCE_LABELS[lead.source]}
                </p>
                <p className="text-xs text-on-surface-variant">
                  Pushed by AarthikLabs on behalf of an ONDC buyer app; no partner
                  organization is involved.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="flex flex-col gap-3 pt-6 md:pt-9">
              <SectionTitle>Branch manager</SectionTitle>
              <Badge
                className={cn(
                  "self-start border-transparent hover:bg-inherit",
                  BRANCH_MANAGER_BADGE_CLASSES[lead.branchManagerStatus]
                )}
              >
                {BRANCH_MANAGER_LABELS[lead.branchManagerStatus]}
              </Badge>
              {lead.branchManagerStatus === "CONFIRMED" && (
                <dl className="grid gap-3">
                  {lead.loanConfirmedAmount !== null && (
                    <Field label="Confirmed amount">
                      {formatInr(lead.loanConfirmedAmount)}
                    </Field>
                  )}
                  {lead.loanConfirmedAt && (
                    <Field label="Confirmed on">{formatDateTime(lead.loanConfirmedAt)}</Field>
                  )}
                </dl>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
