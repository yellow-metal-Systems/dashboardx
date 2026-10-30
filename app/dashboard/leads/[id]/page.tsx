import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  Cake,
  Check,
  ChevronLeft,
  ExternalLink,
  Hash,
  Home,
  Landmark,
  Link2,
  MapPin,
  Phone,
  Receipt,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { ActionsMenu, type MenuAction } from "@/components/leads/actions-menu";
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
  statusBadgeClass,
  statusLabel,
  actorLabel,
} from "@/lib/leads";
import { cn } from "@/lib/utils";
import { getLeadDetail } from "@/lib/leads-repo";
import { staffAccess } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Lead" };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-label-sm uppercase tracking-widest text-label">{children}</h2>;
}

/** One borrower detail: an icon, the label, then the value (the reference's overview-card rows). */
function Field({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-outline-variant/60 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0">
        <dt className="text-paragraph-md text-info-label">{label}</dt>
        <dd className="text-label-lg tabular-nums text-on-surface">{children}</dd>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

/** "Bullet · 68% LTV · 22.2% p.a.", leaving out whatever is missing. */
function planLine(plan: string | null, roi: number | null): string | null {
  const parts = [plan ? offerPlanLabel(plan) : null, roi !== null ? `${roi}% p.a.` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// The path a lead walks; Rejected can end it at any step.
const STEPS = ["LEAD_CREATED", "CONTACTED", "BRANCH_VISIT_SCHEDULED", "DISBURSED"] as const;
const stepDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

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
  // When the lead first reached each step, from its own history; Submitted is when it arrived.
  const reachedAt = new Map<string, string>([["LEAD_CREATED", lead.createdAt]]);
  for (const a of activities) if (a.toStatus && !reachedAt.has(a.toStatus)) reachedAt.set(a.toStatus, a.createdAt);
  const rejected = lead.status === "REJECTED";
  const current = STEPS.indexOf(lead.status as (typeof STEPS)[number]);
  const menu: MenuAction[] = [
    { kind: "copy", label: "Copy mobile", icon: "phone", text: lead.mobile, what: "Mobile" },
    ...(lead.partner ? [{ kind: "link" as const, label: "Open partner", icon: "partner" as const, href: `/dashboard/partners/${lead.partner.id}` }] : []),
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-on-surface-variant">
          <Link href="/dashboard" className="inline-flex items-center gap-1 hover:underline">
            <ChevronLeft className="size-4" aria-hidden="true" /> Leads
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="truncate font-medium text-on-surface">{lead.name}</span>
        </nav>
      </div>

      {/* The lead on the left; what happened to it, beside it (below on narrow screens). */}
      <div className="grid max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardContent className="flex flex-col gap-8 pt-6 md:pt-9">
            {/* Header: name + status, who sent it, then Change status and the "…" actions. */}
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-base font-semibold text-on-surface"
                >
                  {initials(lead.name)}
                </span>
                <div>
                  {/* Tags sit beside the heading, not in it: inside, they took the heading's size and weight. */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-heading-lg text-on-surface">{lead.name}</h1>
                    <span
                      className={cn("inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs", statusBadgeClass(lead.status))}
                      data-status-tag
                    >
                      {statusLabel(lead.status)}
                    </span>
                  </div>
                  {/* New / Duplicate lives here, not beside the status, so a new lead never reads "New New". */}
                  {/* A div, not a p: Badge renders a div, and a div inside a p breaks hydration. */}
                  <div className="mt-1 text-sm leading-6 text-on-surface-variant">
                    <span className="font-semibold text-on-surface">{leadRef(lead)}</span> · Submitted {formatDateTime(lead.createdAt)} by {submitter}
                    <Badge
                      variant={lead.isNewCustomer ? "success" : "pending"}
                      dot={!lead.isNewCustomer}
                      className="ml-2 h-5 align-middle text-xs font-semibold"
                      data-customer-tag
                    >
                      {lead.isNewCustomer ? "New customer" : customerTag(lead)}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 md:max-w-56 md:items-end">
                <div className="flex items-start gap-2">
                  <LeadStatusSelect
                    leadId={lead.id}
                    leadName={lead.name}
                    status={lead.status}
                    isAarthik={isAarthik}
                    canUpdate={access.permissions.includes("leads.update")}
                    asButton
                  />
                  <ActionsMenu label={`More actions for ${lead.name}`} actions={menu} className="[&>summary]:size-9" />
                </div>
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
              <dl className="grid gap-x-8 sm:grid-cols-2">
                <Field label="Mobile number" icon={Phone}>{lead.mobile}</Field>
                <Field label="Pincode" icon={MapPin}>{lead.pinCode}</Field>
                <Field label="Branch" icon={Building2}>
                  {lead.branch
                    ? `${lead.branch.name}${lead.branch.state ? `, ${lead.branch.state}` : ""}`
                    : "To be assigned"}
                </Field>
                {lead.address && <Field label="Address" icon={Home}>{lead.address}</Field>}
                {lead.gstin && (
                  <Field label="GSTIN" icon={Receipt}>
                    <span className="font-mono text-xs">{lead.gstin}</span>
                  </Field>
                )}
                {lead.dob && <Field label="Date of birth" icon={Cake}>{formatDate(lead.dob)}</Field>}
                <Field label="Source" icon={Users}>
                  {lead.partner ? (
                    <Link href={`/dashboard/partners/${lead.partner.id}`} className="underline underline-offset-4">
                      {lead.partner.orgName}
                    </Link>
                  ) : (
                    SOURCE_LABELS[lead.source]
                  )}
                </Field>
                {lead.externalRef && <Field label="Their reference" icon={Hash}>{lead.externalRef}</Field>}
                {lead.agentRef && <Field label="Their agent" icon={UserRound}>{lead.agentRef}</Field>}
                {lead.lspName && <Field label="LSP" icon={Landmark}>{lead.lspName}</Field>}
                {lead.ondcTransactionId && (
                  <Field label="ONDC transaction" icon={Link2}>
                    <span className="select-all break-all font-mono text-xs">{lead.ondcTransactionId}</span>
                  </Field>
                )}
              </dl>
            </section>

            <section className="flex flex-col gap-4">
              <SectionTitle>Requested vs actual</SectionTitle>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5 rounded-lg bg-surface-container-low p-4 md:p-5" data-requested>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Requested</p>
                  <p className="text-heading-lg tabular-nums text-on-surface">
                    {requestedAmount !== null ? formatInr(requestedAmount) : "—"}
                  </p>
                  {lead.loanAmountEstimated && lead.goldGrams !== null && requestedAmount !== null && (
                    <p className="text-sm text-on-surface-variant">Estimated from {lead.goldGrams} g gold</p>
                  )}
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

                <div className="flex flex-col gap-1.5 rounded-lg bg-surface-container-low p-4 md:p-5" data-actual>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Actual</p>
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

        {/* Pinned while the lead scrolls; a long history scrolls inside it instead of running off the screen. */}
        <Card className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
          {/* Explicit md: padding: CardContent's default md:pt-0 left the heading on the card's edge. */}
          <CardContent className="flex flex-col gap-4 p-5 md:p-6 md:pt-6">
            <section className="flex flex-col gap-3" aria-labelledby="progress-title">
              <h2 id="progress-title" className="text-label-sm uppercase tracking-widest text-label">Progress</h2>
              <ol className="flex flex-col gap-3">
                {STEPS.map((step, i) => {
                  const at = reachedAt.get(step);
                  // Rejected: the steps it reached are done, the rest never happened.
                  const state = rejected
                    ? at ? "done" : "todo"
                    : i < current || (i === current && i === STEPS.length - 1) ? "done" : i === current ? "now" : "todo";
                  return (
                    <li key={step} className="flex items-center gap-3 text-sm">
                      <StepMark state={state} />
                      <span className={cn(state === "todo" ? "text-on-surface-variant" : "text-on-surface", state === "now" && "font-semibold")}>
                        {step === "LEAD_CREATED" ? "Submitted" : statusLabel(step)}
                        <span className="sr-only">{state === "done" ? " (done)" : state === "now" ? " (current step)" : " (not reached)"}</span>
                      </span>
                      {at && state !== "todo" && (
                        <span className="ml-auto text-xs tabular-nums text-on-surface-variant">{stepDate.format(new Date(at))}</span>
                      )}
                    </li>
                  );
                })}
                {rejected && (
                  <li className="flex items-center gap-3 text-sm">
                    <StepMark state="rejected" />
                    <span className="font-semibold text-on-error-soft">Rejected</span>
                    {reachedAt.get("REJECTED") && (
                      <span className="ml-auto text-xs tabular-nums text-on-surface-variant">
                        {stepDate.format(new Date(reachedAt.get("REJECTED")!))}
                      </span>
                    )}
                  </li>
                )}
              </ol>
            </section>
            <hr className="border-outline-variant" />
            <section className="flex flex-col gap-4">
              <SectionTitle>Activity</SectionTitle>
              {activities.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No activity recorded.</p>
              ) : (
                <ol className="flex flex-col gap-4 border-l-2 border-outline-variant pl-4">
                  {activities.map((a) => {
                    const by = a.actor ? actorLabel(a.actor, actorNames) : null;
                    // shortcut: matches serverx's "Status changed X → Disbursed" text; if that wording
                    // changes the line just falls back to the stored message. Upgrade if serverx adds a typed event.
                    const message =
                      a.message.endsWith("→ Disbursed") && lead.disbursementAmount !== null
                        ? `Disbursed ${formatInr(lead.disbursementAmount)}`
                        : a.message;
                    return (
                      <li key={a.id} className="relative min-w-0 text-sm leading-5 text-on-surface">
                        <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-outline" />
                        <time dateTime={a.createdAt} className="block text-xs text-on-surface-variant">
                          {activityTime.format(new Date(a.createdAt))}
                        </time>
                        <p className="mt-0.5 break-words">
                          {message}
                          {/* Skipped when the message already names them ("…by Asha Rao"). */}
                          {by && !message.includes(by) && <span className="text-on-surface-variant"> by {by}</span>}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** A progress step: green tick (done), green ring (current), grey circle (to come), red cross (rejected). */
function StepMark({ state }: { state: "done" | "now" | "todo" | "rejected" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full",
        state === "done" && "bg-success-soft text-on-success-soft",
        state === "now" && "ring-2 ring-inset ring-on-success-soft",
        state === "todo" && "ring-1 ring-inset ring-outline-variant",
        state === "rejected" && "bg-error-soft text-on-error-soft"
      )}
    >
      {state === "done" && <Check className="size-3" strokeWidth={3} />}
      {state === "now" && <span className="size-1.5 rounded-full bg-on-success-soft" />}
      {state === "rejected" && <X className="size-3" strokeWidth={3} />}
    </span>
  );
}
