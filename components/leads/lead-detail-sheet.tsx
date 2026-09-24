"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  ACCEPTANCE_LABELS,
  BRANCH_MANAGER_BADGE_CLASSES,
  BRANCH_MANAGER_LABELS,
  LEAD_STATUSES,
  SOURCE_LABELS,
  STATUS_BADGE_CLASSES,
  duplicatesOf,
  formatDate,
  formatDateTime,
  formatInr,
  leadRef,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";

type Props = {
  lead: Lead | null;
  allLeads: Lead[];
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onSelectLead: (id: string) => void;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-label-sm uppercase tracking-widest text-label">
        {title}
      </h3>
      <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-4 gap-y-1.5 text-sm">
        {children}
      </dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-paragraph-md text-info-label">{label}</dt>
      <dd className="min-w-0 break-words text-on-surface">{children}</dd>
    </>
  );
}

export function LeadDetailSheet({
  lead,
  allLeads,
  onOpenChange,
  onStatusChange,
  onSelectLead,
}: Props) {
  const duplicates = lead ? duplicatesOf(lead, allLeads) : [];
  const isPartner = lead?.source === "PARTNER";
  const isAarthik = lead?.source === "AARTHIKLABS";
  const kfsIsUrl = lead?.kfsReference?.startsWith("http") ?? false;

  return (
    <Sheet open={lead !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg"
      >
        {lead && (
          <>
            <SheetHeader className="space-y-2 pr-6 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[11px]">
                  {leadRef(lead)}
                </Badge>
                <Badge
                  className={cn(
                    "border-transparent hover:bg-inherit",
                    isAarthik
                      ? "bg-black-solid font-bold text-white"
                      : "bg-secondary-container font-extrabold text-on-secondary-container"
                  )}
                >
                  {SOURCE_LABELS[lead.source]}
                </Badge>
                {lead.duplicateFlag && (
                  <Badge className="border-transparent bg-secondary-container text-on-secondary-container hover:bg-secondary-container">
                    Duplicate
                  </Badge>
                )}
              </div>
              <SheetTitle className="text-xl">{lead.name}</SheetTitle>
              <SheetDescription>
                {lead.mobile} · {lead.pinCode}
              </SheetDescription>
              <Link
                href={`/dashboard/leads/${lead.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Open full page <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </SheetHeader>

            <Section title="Borrower">
              <Row label="Name">{lead.name}</Row>
              <Row label="Mobile">{lead.mobile}</Row>
              <Row label="Address">{lead.address}</Row>
              <Row label="Pincode">{lead.pinCode}</Row>
              {lead.dob && <Row label="Date of birth">{formatDate(lead.dob)}</Row>}
            </Section>

            <Section title="Loan details">
              {isPartner && lead.loanAmount !== null && (
                <Row label="Requested amount">{formatInr(lead.loanAmount)}</Row>
              )}
              {isAarthik && lead.offerAmount !== null && (
                <Row label="Offer amount">{formatInr(lead.offerAmount)}</Row>
              )}
              {isAarthik && lead.goldGrams !== null && (
                <Row label="Gold">{lead.goldGrams} g</Row>
              )}
              {isAarthik && lead.ltvPercent !== null && (
                <Row label="LTV">{lead.ltvPercent}%</Row>
              )}
            </Section>

            <Section title="Source">
              <Row label="Channel">{SOURCE_LABELS[lead.source]}</Row>
              {lead.partner && (
                <>
                  <Row label="Partner org">{lead.partner.orgName}</Row>
                  <Row label="Partner contact">
                    <a
                      href={`mailto:${lead.partner.contactEmail}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {lead.partner.contactEmail}
                    </a>
                  </Row>
                </>
              )}
            </Section>

            {lead.duplicateFlag && (
              <section className="flex flex-col gap-2">
                <h3 className="text-label-sm uppercase tracking-widest text-label">
                  Duplicate of
                </h3>
                {duplicates.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">
                    No other lead with this mobile number is in the current list.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {duplicates.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => onSelectLead(d.id)}
                          className="flex w-full items-center justify-between gap-3 rounded border border-outline-variant bg-surface-container-low px-3 py-2 text-left text-sm hover:bg-surface-container focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <span className="flex min-w-0 flex-col">
                            <span className="font-mono text-[11px] text-on-surface-variant">
                              {leadRef(d)}
                            </span>
                            <span className="truncate text-on-surface">
                              {d.partner?.orgName ?? SOURCE_LABELS[d.source]} ·{" "}
                              {formatDate(d.createdAt)}
                            </span>
                          </span>
                          <Badge
                            className={cn(
                              "shrink-0 border-transparent hover:bg-inherit",
                              STATUS_BADGE_CLASSES[d.status]
                            )}
                          >
                            {d.status}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {lead.kfsReference && (
              <Section title="Key Fact Statement">
                <Row label="Reference">
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
                </Row>
              </Section>
            )}

            <Section title="Status">
              <Row label="Lead status">
                <Select
                  value={lead.status}
                  onValueChange={(v) => onStatusChange(lead.id, v as LeadStatus)}
                >
                  <SelectTrigger
                    aria-label={`Status for ${lead.name}`}
                    className={cn(
                      "h-8 w-36 border-transparent",
                      STATUS_BADGE_CLASSES[lead.status]
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              {isAarthik && (
                <Row label="Offer acceptance">
                  {ACCEPTANCE_LABELS[lead.acceptanceState]}
                </Row>
              )}
            </Section>

            <Section title="Branch manager">
              <Row label="Hand-off">
                <Badge
                  className={cn(
                    "border-transparent hover:bg-inherit",
                    BRANCH_MANAGER_BADGE_CLASSES[lead.branchManagerStatus]
                  )}
                >
                  {BRANCH_MANAGER_LABELS[lead.branchManagerStatus]}
                </Badge>
              </Row>
              {lead.branchManagerStatus === "CONFIRMED" &&
                lead.loanConfirmedAmount !== null && (
                  <Row label="Confirmed amount">
                    {formatInr(lead.loanConfirmedAmount)}
                  </Row>
                )}
              {lead.branchManagerStatus === "CONFIRMED" && lead.loanConfirmedAt && (
                <Row label="Confirmed on">{formatDateTime(lead.loanConfirmedAt)}</Row>
              )}
            </Section>

            <Section title="Timeline">
              <Row label="Created">{formatDateTime(lead.createdAt)}</Row>
              <Row label="Last updated">{formatDateTime(lead.updatedAt)}</Row>
            </Section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
