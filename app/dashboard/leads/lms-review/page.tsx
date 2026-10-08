import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LmsResolveForm } from "@/components/leads/lms-resolve-form";
import { requireStaff } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatInr, statusLabel } from "@/lib/leads";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const EVENT_LABEL = { DISBURSED: "Disbursed", REJECTED: "Rejected", CANCELLED: "Cancelled" } as const;

// LMS updates no lead could be matched to: no YMLEAD number on the loan, and no
// single open lead with that mobile. Staff pick the lead; serverx applies it.
export default async function LmsReviewPage() {
  await requireStaff();
  const events = await prisma.lmsLoanEvent.findMany({
    where: { outcome: { in: ["UNMATCHED", "AMBIGUOUS"] } },
    orderBy: { receivedAt: "asc" },
    take: 100,
  });
  const mobiles = Array.from(new Set(events.map((e) => e.mobileSent).filter((m): m is string => !!m)));
  const candidates = mobiles.length
    ? await prisma.lead.findMany({
        where: { mobile: { in: mobiles }, status: { not: "REJECTED" } },
        select: { id: true, name: true, status: true, mobile: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" /> Leads
        </Link>
      </div>
      <div>
        <h1 className="text-heading-lg text-on-surface">LMS updates to match</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          The Loan Managers App reported these loans, but we couldn&apos;t tell which lead each one belongs to. Pick the lead and it
          updates exactly as if the LMS had named it.
        </p>
      </div>
      {events.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-on-surface-variant md:p-10">Nothing to match.</CardContent>
        </Card>
      ) : (
        events.map((e) => (
          <Card key={e.id} data-lms-event={e.eventId}>
            <CardContent className="flex flex-col gap-3 p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={e.event === "DISBURSED" ? "success" : "destructive"}>{EVENT_LABEL[e.event]}</Badge>
                <Badge variant="grey">{e.outcome === "AMBIGUOUS" ? "Several leads match" : "No lead found"}</Badge>
                <span className="text-on-surface-variant">received {formatDateTime(e.receivedAt.toISOString())}</span>
              </div>
              <p className="text-sm text-on-surface">
                {e.loanId ? <>Loan <b>{e.loanId}</b> · </> : null}
                {e.leadIdSent ? <>lead number sent: <span className="font-mono">{e.leadIdSent}</span> · </> : null}
                {e.mobileSent ? <>mobile {e.mobileSent} · </> : null}
                {e.amount ? <>{formatInr(Number(e.amount))} · </> : null}
                {e.disbursementDate ? <>on {formatDate(e.disbursementDate.toISOString())}</> : null}
                {e.reason ? <> · {e.reason}</> : null}
              </p>
              <LmsResolveForm
                eventId={e.id}
                candidates={candidates
                  .filter((c) => c.mobile === e.mobileSent)
                  .map((c) => ({ id: c.id, name: c.name, status: statusLabel(c.status) }))}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
