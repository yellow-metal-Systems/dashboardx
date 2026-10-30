import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  CountersignPanel,
  RejectApplication,
  ResendAgreementForm,
  SendAgreementForm,
  type Rates,
} from "@/components/partners/application-controls";
import { RATE_INPUTS, TEMPLATE_TITLES, agreementFields } from "@/lib/agreements/fields";
import { indianNumber } from "@/lib/agreements/format";
import { requirePermission } from "@/lib/auth/session";
import { emailMode } from "@/lib/email";
import { formatDateTime } from "@/lib/leads";
import { APPLICATION_STATUS_LABELS, defaultRates, getApplication, type ApplicationStatus } from "@/lib/partners/applications";
import { cn } from "@/lib/utils";

// One sign-up application (plan of 27 Oct 2026, B4): who applied, the agreement
// (send → signed → countersigned), and its history. Anyone with partners.view
// reads it; sending, resending, rejecting and the PDFs need partners.manage;
// countersigning needs agreements.countersign (admins).
export const dynamic = "force-dynamic";

export const metadata = { title: "Partner application" };

const STATUS_BADGE: Record<ApplicationStatus, BadgeProps["variant"]> = {
  PENDING: "pending",
  AGREEMENT_SENT: "grey",
  SIGNED: "pending",
  APPROVED: "success",
  REJECTED: "destructive",
};

const EVENT_LABELS: Record<string, string> = {
  applied: "Applied",
  agreement_sent: "Agreement sent",
  agreement_resent: "New signing link sent",
  link_opened: "Applicant opened the signing link",
  signed: "Applicant signed",
  approved: "Countersigned and approved",
  rejected: "Rejected",
  email_failed: "An email failed to send",
};

const OPEN: ApplicationStatus[] = ["PENDING", "AGREEMENT_SENT", "SIGNED"];

const at = (d: Date) => formatDateTime(d.toISOString());
const maskPan = (pan: string) => `${pan.slice(0, 2)}••••••${pan.slice(-2)}`;
const rateText = (v: number | null | undefined, unit: "Rs" | "%") =>
  v == null ? "Blank" : unit === "Rs" ? `₹${indianNumber(v)}` : `${v}%`;

/** The rates stored on the agreement, or null if the stored fields don't parse (never expected). */
function storedRates(fields: unknown): Rates | null {
  const parsed = agreementFields.safeParse(fields);
  return parsed.success ? (parsed.data.rates as Rates) : null;
}

const STEPS: { status: ApplicationStatus; label: string }[] = [
  { status: "PENDING", label: "Applied" },
  { status: "AGREEMENT_SENT", label: "Agreement sent" },
  { status: "SIGNED", label: "Signed" },
  { status: "APPROVED", label: "Approved" },
];

/** Where the application is in the flow: done steps ticked, the current one dark, the rest outlined. */
function Progress({ status }: { status: ApplicationStatus }) {
  const current = STEPS.findIndex((s) => s.status === status);
  return (
    <ol aria-label="Progress" className="flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((s, i) => {
        const done = i < current || status === "APPROVED";
        const here = i === current && !done;
        return (
          <li key={s.status} aria-current={here ? "step" : undefined} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className={cn("h-px w-6 sm:w-10", i <= current ? "bg-black-solid" : "bg-outline-variant")} />}
            <span
              aria-hidden
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                done ? "bg-success-solid text-white" : here ? "bg-black-solid text-white" : "border border-outline-variant text-on-surface-variant"
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={done || here ? "font-medium text-on-surface" : "text-on-surface-variant"}>
              {s.label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One PDF's view and download links on a line, labelled, so the two copies don't run together. */
function PdfLinks({ label, href }: { label: string; href: string }) {
  const download = `${href}${href.includes("?") ? "&" : "?"}download=1`;
  return (
    <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className="w-40 text-on-surface-variant">{label}</span>
      <a href={href} target="_blank" rel="noopener" className="font-semibold text-link underline underline-offset-4 hover:text-link-hover">
        View<span className="sr-only"> {label.toLowerCase()}</span>
      </a>
      <a href={download} className="font-semibold text-link underline underline-offset-4 hover:text-link-hover">
        Download<span className="sr-only"> {label.toLowerCase()}</span>
      </a>
    </p>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 text-sm sm:grid-cols-[11rem_1fr] sm:gap-3">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="min-w-0 break-words text-on-surface">{children}</dd>
    </div>
  );
}

export default async function ApplicationPage({ params }: { params: { id: string } }) {
  const access = await requirePermission("partners.view");
  const canManage = access.permissions.includes("partners.manage");
  const canCountersign = access.permissions.includes("agreements.countersign");
  const app = await getApplication(params.id);
  if (!app) notFound();

  const status = app.status as ApplicationStatus;
  const { agreement, template } = app;
  const inputs = RATE_INPUTS[template];
  const rates = agreement ? storedRates(agreement.fields) : null;
  const linkExpired = agreement?.status === "SENT" && agreement.tokenExpiresAt <= new Date();
  const pdf = `/dashboard/partners/applications/${app.id}/agreement`;
  // Applications from before the new sign-up form lack what the agreement needs (fieldsFor refuses them).
  const missingDetails = !app.email || !app.address || (template === "BC" ? !app.pan : !app.companyName);
  // Read from the history, not the send form's result, so it survives the re-render and a reload.
  const lastEmailFailed = app.events.at(-1)?.action === "email_failed";

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Link
          href={`/dashboard/partners?tab=applications&status=${status}`}
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden="true" /> Applications
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-heading-lg text-on-surface">{app.companyName ?? app.name}</h1>
        <Badge variant={STATUS_BADGE[status]}>{APPLICATION_STATUS_LABELS[status]}</Badge>
        <span className="text-sm text-on-surface-variant">
          {app.applicantType === "COMPANY" ? "Company" : "Individual"} · applied {at(app.createdAt)}
        </span>
      </div>
      {status !== "REJECTED" && <Progress status={status} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applicant</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-outline-variant">
              {app.companyName && <Row label="Company">{app.companyName}</Row>}
              <Row label={app.companyName ? "Contact person" : "Name"}>{app.name}</Row>
              <Row label="Email">{app.email ?? "—"}</Row>
              <Row label="Mobile">
                <span className="tabular-nums">{app.mobile}</span>
              </Row>
              <Row label="Town">{app.town}</Row>
              <Row label={app.companyName ? "Registered office" : "Address"}>{app.address ?? "—"}</Row>
              {app.pan && (
                <Row label="PAN">
                  <span className="font-mono">{maskPan(app.pan)}</span>
                </Row>
              )}
              {app.applicantType === "COMPANY" && <Row label="GSTIN">{app.gstin ?? "Not given"}</Row>}
            </dl>
            {canManage && OPEN.includes(status) && (
              <p className="mt-4 text-xs text-on-surface-variant">The mobile number is not verified. Call the applicant before sending the agreement.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{TEMPLATE_TITLES[template]}</CardTitle>
            <p className="text-sm text-on-surface-variant">
              {template === "BC" ? "Individuals sign the BC agreement." : "Companies sign the DSA agreement."}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {status === "PENDING" &&
              (!canManage ? (
                <p className="text-sm text-on-surface-variant">Waiting for an admin to send the agreement.</p>
              ) : missingDetails ? (
                <p className="text-sm text-on-surface">
                  This application is missing details the agreement needs (it predates the new sign-up form). Reject it and ask the
                  applicant to apply again.
                </p>
              ) : (
                <SendAgreementForm applicationId={app.id} inputs={inputs} defaults={defaultRates(template) as Rates} />
              ))}

            {status === "AGREEMENT_SENT" &&
              canManage &&
              (lastEmailFailed ? (
                <p role="alert" className="text-sm font-medium text-error">
                  The last email to {app.email} failed to send. Send a new link to try again.
                </p>
              ) : (
                emailMode() === "log" && (
                  <p className="text-sm text-on-surface-variant">
                    Demo mode: emails are saved, not sent. The signing link is in{" "}
                    <Link href="/dashboard/emails" className="font-semibold text-link underline underline-offset-4 hover:text-link-hover">
                      Sent emails
                    </Link>
                    .
                  </p>
                )
              ))}

            {agreement && (
              <dl className="divide-y divide-outline-variant">
                <Row label="Sent">
                  {at(agreement.sentAt)} by {agreement.sentBy}
                </Row>
                {agreement.status === "SENT" && (
                  <Row label="Signing link">
                    {linkExpired ? (
                      <Badge variant="destructive">Expired {at(agreement.tokenExpiresAt)}</Badge>
                    ) : (
                      `Works until ${at(agreement.tokenExpiresAt)}`
                    )}
                  </Row>
                )}
                {inputs.map((r) => (
                  <Row key={r.name} label={r.label}>
                    <span className="tabular-nums">{rates ? rateText(rates[r.name], r.unit) : "—"}</span>
                  </Row>
                ))}
                {agreement.signedAt && (
                  <>
                    <Row label="Signed">
                      “{agreement.signerTypedName}” on {at(agreement.signedAt)}
                    </Row>
                    <Row label="Signed from">
                      {agreement.signerIp ?? "Unknown IP"}
                      <span className="block truncate text-xs text-on-surface-variant" title={agreement.signerUserAgent ?? undefined}>
                        {agreement.signerUserAgent ?? "Unknown device"}
                      </span>
                    </Row>
                  </>
                )}
                {agreement.countersignedAt && (
                  <Row label="Countersigned">
                    {agreement.countersignerName} ({agreement.countersignedBy}) on {at(agreement.countersignedAt)}
                  </Row>
                )}
              </dl>
            )}

            {canManage && agreement && (
              <div className="flex flex-col gap-2 text-sm">
                <PdfLinks label="Agreement as sent" href={pdf} />
                {agreement.status === "EXECUTED" && <PdfLinks label="Signed copy" href={`${pdf}?file=executed`} />}
              </div>
            )}

            {status === "AGREEMENT_SENT" &&
              canManage &&
              (rates ? (
                <ResendAgreementForm applicationId={app.id} inputs={inputs} current={rates} />
              ) : (
                <p className="text-sm text-error">The stored agreement details can&apos;t be read, so it can&apos;t be resent. Reject it instead.</p>
              ))}

            {/* Same place for SIGNED and APPROVED, so the one-time link survives approval's re-render. */}
            {(status === "SIGNED" || status === "APPROVED") &&
              (canCountersign ? (
                <CountersignPanel applicationId={app.id} staffName={access.name} done={status === "APPROVED"} />
              ) : (
                status === "SIGNED" && <p className="text-sm text-on-surface-variant">Waiting for an admin to countersign and approve.</p>
              ))}

            {status === "APPROVED" && app.partnerId && (
              <Link href={`/dashboard/partners/${app.partnerId}`} className="w-fit text-sm font-semibold text-link underline underline-offset-4 hover:text-link-hover">
                Open the partner
              </Link>
            )}

            {status === "REJECTED" && (
              <p className="text-sm text-on-surface">
                Rejected{app.reviewedAt && ` on ${at(app.reviewedAt)}`}
                {app.reviewedBy && ` by ${app.reviewedBy}`}: “{app.rejectReason}”
              </p>
            )}

            {canManage && OPEN.includes(status) && <RejectApplication applicationId={app.id} name={app.companyName ?? app.name} />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2 text-sm">
              {app.events.map((e) => {
                const reason = e.action === "rejected" ? (e.detail as { reason?: string } | null)?.reason : undefined;
                return (
                  <li key={e.id} className="flex flex-wrap gap-x-3">
                    <span className="whitespace-nowrap tabular-nums text-on-surface-variant">{at(e.createdAt)}</span>
                    <span className="font-medium text-on-surface">{EVENT_LABELS[e.action] ?? e.action}</span>
                    <span className="text-on-surface-variant">
                      {e.actor === "applicant" ? "by the applicant" : e.actor === "system" ? "" : `by ${e.actor}`}
                      {reason && `: “${reason}”`}
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
