import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CreateApiKey, ResendInvite, RevokeApiKey, TogglePartner } from "@/components/partners/partner-controls";
import { isAdmin, requireStaff } from "@/lib/auth/session";
import { PARTNER_STATUS_BADGE_CLASSES, formatDate, formatInr, statusLabel } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { invited: "Invited", active: "Active", disabled: "Turned off" };

export default async function PartnerPage({ params }: { params: { id: string } }) {
  const staff = await requireStaff();
  const admin = await isAdmin(staff);
  const p = await prisma.partner.findUnique({
    where: { id: params.id },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      apiKeys: { orderBy: { createdAt: "desc" } },
      payoutDetails: { select: { partnerId: true } },
      leads: { orderBy: { createdAt: "desc" }, take: 25, select: { id: true, name: true, status: true, createdAt: true } },
      _count: { select: { leads: true } },
    },
  });
  if (!p) notFound();
  // Money only for admins: team members' page never queries an amount.
  const sums = admin
    ? await prisma.partnerReward.groupBy({ by: ["status"], where: { partnerId: p.id }, _sum: { amount: true } })
    : [];
  const sum = (s: string) => Number(sums.find((g) => g.status === s)?._sum.amount ?? 0);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      <Link href="/dashboard/partners" className="flex w-fit items-center gap-1 text-sm text-on-surface-variant hover:underline">
        <ChevronLeft className="size-4" /> All partners
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-heading-lg text-on-surface">{p.orgName}</h1>
        <Badge className={cn("border-transparent", PARTNER_STATUS_BADGE_CLASSES[p.status])}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
        <span className="text-sm text-on-surface-variant">
          {p.type === "ORGANISATION" ? "Organisation" : "Individual"}
          {p.isOndc ? " · ONDC" : ""} · {p.contactEmail} · {p._count.leads} leads · added {formatDate(p.createdAt.toISOString())}
        </span>
        <span className="ml-auto">
          <TogglePartner partnerId={p.id} enabled={p.status !== "disabled"} />
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <p className="text-sm text-on-surface-variant">People who can sign in to the LeadBridge app</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {p.users.map((u) => (
              <div key={u.id} className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <b className="text-on-surface">{u.name}</b>
                  <span className="tabular-nums text-on-surface-variant">{u.mobile}</span>
                  <Badge className={cn("border-transparent", PARTNER_STATUS_BADGE_CLASSES[u.status])}>{STATUS_LABEL[u.status] ?? u.status}</Badge>
                  <span className="text-xs text-on-surface-variant">
                    {u.lastLoginAt ? `last signed in ${formatDate(u.lastLoginAt.toISOString())}` : "never signed in"}
                  </span>
                </div>
                {p.status !== "disabled" && <ResendInvite partnerUserId={u.id} name={u.name} />}
              </div>
            ))}
          </CardContent>
        </Card>

        {admin && (
          <Card data-rewards-card>
            <CardHeader><CardTitle>Rewards</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="block text-on-surface-variant">To approve</span><b>{formatInr(sum("PENDING"))}</b></div>
              <div><span className="block text-on-surface-variant">To pay</span><b>{formatInr(sum("APPROVED"))}</b></div>
              <div><span className="block text-on-surface-variant">Paid</span><b>{formatInr(sum("PAID"))}</b></div>
              <p className="col-span-3 text-xs text-on-surface-variant">
                {p.payoutDetails ? "PAN and bank details added." : "No PAN and bank details yet — they add them in the LeadBridge app."}{" "}
                <Link href={`/dashboard/rewards/${p.id}`} className="font-bold text-link hover:underline">Open statement</Link>
              </p>
            </CardContent>
          </Card>
        )}

        <Card className={admin ? "lg:col-span-2" : undefined} data-partner-leads>
          <CardHeader>
            <CardTitle>Leads</CardTitle>
            <p className="text-sm text-on-surface-variant">
              {p._count.leads} from this partner{p._count.leads > p.leads.length ? ` · latest ${p.leads.length}` : ""} ·{" "}
              <Link href={`/dashboard/rewards/${p.id}`} className="text-link hover:underline">rewards by lead</Link>
            </p>
          </CardHeader>
          <CardContent>
            {p.leads.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No leads yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant text-sm">
                {p.leads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/dashboard/leads/${l.id}`} className="font-medium hover:underline">{l.name}</Link>
                    <span className="flex items-center gap-3 text-on-surface-variant">
                      <span>{statusLabel(l.status)}</span>
                      <span className="tabular-nums">{formatDate(l.createdAt.toISOString())}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>API keys</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-on-surface-variant">
              For organisations sending leads from their own systems (LeadBridge /api/v1). Send them the key and docs/API.md.
            </p>
            {p.status !== "disabled" && <CreateApiKey partnerId={p.id} />}
            {p.apiKeys.length > 0 && (
              <ul className="flex flex-col gap-2">
                {p.apiKeys.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-container-low p-3 text-sm">
                    <span className="font-mono text-xs">lb_{k.keyPrefix}_…</span>
                    <b>{k.label}</b>
                    <span className="text-xs text-on-surface-variant">
                      created {formatDate(k.createdAt.toISOString())} ·{" "}
                      {k.lastUsedAt ? `last used ${formatDate(k.lastUsedAt.toISOString())}` : "never used"}
                    </span>
                    <span className="ml-auto">
                      {k.revokedAt ? (
                        <span className="text-xs font-bold text-error">Revoked {formatDate(k.revokedAt.toISOString())}</span>
                      ) : (
                        <RevokeApiKey keyId={k.id} />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
