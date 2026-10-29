import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";

import { LeadStatusSelect } from "@/components/leads/lead-status-select";
import { MaxEligibleLoan, MaxEligibleLoanSkeleton } from "@/components/leads/max-eligible-loan";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  ACCEPTANCE_LABELS,
  SOURCE_LABELS,
  customerTag,
  formatDate,
  formatDateTime,
  formatInr,
  offerPlanLabel,
  leadRef,
  statusLabel,
  actorLabel,
} from "@/lib/leads";
import { getLeadDetail } from "@/lib/leads-repo";
import { staffAccess } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Lead" };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-label-sm uppercase tracking-widest text-label">{children}</h2>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0">
      <dt className="text-paragraph-md text-info-label">{label}</dt>
      <dd className="text-label-lg tabular-nums text-on-surface">{children}</dd>
    </div>
  );
}

/** "Bullet · 68% LTV · 22.2% p.a.", leaving out whatever is missing. */
function planLine(plan: string | null, roi: number | null): string | null {
  const parts = [plan ? offerPlanLabel(plan) : null, roi !== null ? `${roi}% p.a.` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// "15 Oct, 4:27 pm", like the partner app's timeline.
const activityTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export default async function LeadPage({ params }: { params: { id: string } }) {
  const [detail, access] = await Promise.all([getLeadDetail(params.id), staffAccess()]);
  if (!detail) notFound();
  const { lead, activities, webhookEvents, actorNames } = detail;

  const isAarthik = lead.source === "AARTHIKLABS";
  const submitter = lead.partner?.orgName ?? SOURCE_LABELS[lead.source];
  const kfsIsUrl = lead.kfsReference?.startsWith("http") ?? false;
  const requestedAmount = lead.loanAmount ?? lead.offerAmount;
  const requestedPlan = planLine(lead.offerProductType, lead.offerRoiPercentPa);
  const actualPlan = planLine(lead.disbursedPlan, lead.disbursedRoiPercentPa);
  const failedUpdates = webhookEvents.filter((e) => e.deliveryStatus === "failed");

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:underline">
          <ChevronLeft className="size-4" aria-hidden="true" /> Leads
        </Link>
      </div>

      <Card className="max-w-4xl">
        <CardContent className="flex flex-col gap-8 pt-6 md:pt-9">
          {/* Header: name + tag, who sent it, and the status control. */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-heading-lg text-on-surface">
                {lead.name}
                <Badge variant={lead.isNewCustomer ? "success" : "pending"} dot={!lead.isNewCustomer} data-customer-tag>
                  {customerTag(lead)}
                </Badge>
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                <span className="font-semibold text-on-surface">{leadRef(lead)}</span> · Submitted {formatDateTime(lead.createdAt)} by {submitter}
              </p>
            </div>
            <div className="flex flex-col gap-2 md:w-56">
              <LeadStatusSelect
                leadId={lead.id}
                leadName={lead.name}
                status={lead.status}
                isAarthik={isAarthik}
                canUpdate={access.permissions.includes("leads.update")}
                className="w-full"
              />
              {lead.lmsUpdatedAt && (
                <div className="flex items-center gap-2 text-xs text-on-surface-variant" data-lms-tag>
                  <Badge variant="grey">LMS</Badge> Updated by the Loan Managers App on{" "}
                  {formatDateTime(lead.lmsUpdatedAt)}
                </div>
              )}
            </div>
          </div>

          <section className="flex flex-col gap-4">
            <SectionTitle>Borrower</SectionTitle>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Mobile number">{lead.mobile}</Field>
              <Field label="Pincode">{lead.pinCode}</Field>
              <Field label="Branch">
                {lead.branch
                  ? `${lead.branch.name}${lead.branch.state ? `, ${lead.branch.state}` : ""}`
                  : "To be assigned"}
              </Field>
              {lead.address && <Field label="Address">{lead.address}</Field>}
              {lead.gstin && (
                <Field label="GSTIN">
                  <span className="font-mono text-xs">{lead.gstin}</span>
                </Field>
              )}
              {lead.dob && <Field label="Date of birth">{formatDate(lead.dob)}</Field>}
              <Field label="Source">
                {lead.partner ? (
                  <Link href={`/dashboard/partners/${lead.partner.id}`} className="underline underline-offset-4">
                    {lead.partner.orgName}
                  </Link>
                ) : (
                  SOURCE_LABELS[lead.source]
                )}
              </Field>
              {lead.externalRef && <Field label="Their reference">{lead.externalRef}</Field>}
              {lead.agentRef && <Field label="Their agent">{lead.agentRef}</Field>}
              {lead.lspName && <Field label="LSP">{lead.lspName}</Field>}
              {lead.ondcTransactionId && (
                <Field label="ONDC transaction">
                  <span className="select-all break-all font-mono text-xs">{lead.ondcTransactionId}</span>
                </Field>
              )}
            </dl>
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle>Requested vs actual</SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-lg bg-surface-container-low p-4" data-requested>
                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Requested</p>
                <p className="text-heading-lg tabular-nums text-on-surface">
                  {lead.loanAmountEstimated && lead.goldGrams !== null && requestedAmount !== null
                    ? `${lead.goldGrams} g gold, estimated ${formatInr(requestedAmount)}`
                    : requestedAmount !== null
                      ? formatInr(requestedAmount)
                      : "—"}
                </p>
                {requestedPlan && <p className="text-sm text-on-surface">{requestedPlan}</p>}
                {isAarthik && (
                  <p className="text-xs text-on-surface-variant">
                    Offer: {ACCEPTANCE_LABELS[lead.acceptanceState]}
                    {lead.offerTenureDays !== null && ` · ${lead.offerTenureDays} days`}
                    {lead.offerProcessingFee !== null && ` · fee ${formatInr(lead.offerProcessingFee)}`}
                  </p>
                )}
                {lead.kfsReference &&
                  (kfsIsUrl ? (
                    <a
                      href={lead.kfsReference}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-link underline underline-offset-4 hover:text-link-hover"
                    >
                      Open KFS <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ) : (
                    <p className="font-mono text-xs text-on-surface-variant">KFS {lead.kfsReference}</p>
                  ))}
              </div>

              <div className="flex flex-col gap-3 rounded-lg bg-surface-container-low p-4" data-actual>
                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Actual</p>
                {lead.disbursementAmount !== null ? (
                  <>
                    <p className="text-heading-lg tabular-nums text-on-surface">{formatInr(lead.disbursementAmount)}</p>
                    {actualPlan && <p className="text-sm text-on-surface">{actualPlan}</p>}
                    <p className="text-xs text-on-surface-variant">
                      {lead.disbursementDate && `Disbursed ${formatDate(lead.disbursementDate)}`}
                      {lead.loanId && ` · loan ${lead.loanId}`}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-on-surface-variant">Not disbursed yet.</p>
                )}
              </div>
            </div>

            {lead.goldGrams !== null && (
              <Suspense fallback={<MaxEligibleLoanSkeleton />}>
                <MaxEligibleLoan leadId={lead.id} goldGrams={lead.goldGrams} />
              </Suspense>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle>Activity</SectionTitle>
            {activities.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No activity recorded.</p>
            ) : (
              <ol className="flex flex-col gap-2 border-l-2 border-outline-variant pl-4">
                {activities.map((a) => {
                  const by = a.actor ? actorLabel(a.actor, actorNames) : null;
                  // shortcut: matches serverx's "Status changed X → Disbursed" text; if that wording
                  // changes the line just falls back to the stored message. Upgrade if serverx adds a typed event.
                  const message =
                    a.message.endsWith("→ Disbursed") && lead.disbursementAmount !== null
                      ? `Disbursed ${formatInr(lead.disbursementAmount)}`
                      : a.message;
                  return (
                    <li key={a.id} className="relative text-sm text-on-surface">
                      <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-outline" />
                      <time dateTime={a.createdAt} className="text-on-surface-variant">
                        {activityTime.format(new Date(a.createdAt))}
                      </time>
                      {" · "}
                      {message}
                      {/* Skipped when the message already names them ("…by Asha Rao"). */}
                      {by && !message.includes(by) && <span className="text-on-surface-variant"> by {by}</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {failedUpdates.length > 0 && (
            <section className="flex flex-col gap-2 rounded-lg bg-error-container p-4 text-on-error-container">
              <SectionTitle>AarthikLabs updates that failed</SectionTitle>
              <ul className="flex flex-col gap-1 text-sm">
                {failedUpdates.map((e) => (
                  <li key={e.id}>
                    {statusLabel(e.statusSent)} · {formatDateTime(e.createdAt)}
                    {e.errorMessage && ` · ${e.errorMessage}`} — needs manual follow-up
                  </li>
                ))}
              </ul>
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
