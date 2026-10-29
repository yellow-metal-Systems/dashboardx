import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { RewardRulesForm } from "@/components/rewards/reward-controls";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { staffAccess } from "@/lib/auth/session";
import { formatDate, formatDateTime } from "@/lib/leads";
import { currentRewardRules, rewardRulesHistory } from "@/lib/partners/rewards";
import { integrationStatus } from "@/lib/settings/integrations";

export const dynamic = "force-dynamic";

// Settings: every member sees My account; the other sections follow permissions,
// so nobody is shown a section they could not act on.

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3 first:pt-0 last:pb-0">
      <dt className="text-sm text-on-surface-variant">{label}</dt>
      <dd className="text-sm text-on-surface">{children}</dd>
    </div>
  );
}

const when = (d: Date | null) => (d ? formatDateTime(d.toISOString()) : "Never");

export default async function SettingsPage() {
  const access = await staffAccess();
  const editRules = access.permissions.includes("rewardRules.manage");
  const seeIntegrations = access.permissions.includes("integrations.view");

  const [rules, history, status] = await Promise.all([
    editRules ? currentRewardRules() : Promise.resolve(null),
    editRules ? rewardRulesHistory() : Promise.resolve([]),
    seeIntegrations ? integrationStatus() : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div>
        <h1 className="text-heading-lg text-on-surface">Settings</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Your account{editRules || seeIntegrations ? " and how LeadDesk is set up" : ""}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <dl className="flex max-w-md flex-col divide-y divide-outline-variant">
            <Row label="Name">{access.name}</Row>
            <Row label="Email">{access.email}</Row>
            <Row label="Role">{ROLE_LABELS[access.role]}</Row>
          </dl>
          <div className="border-t border-outline-variant pt-6">
            <h2 className="mb-4 text-sm font-bold text-on-surface">Change password</h2>
            <ChangePasswordForm email={access.email} />
          </div>
        </CardContent>
      </Card>

      {rules && (
        <Card>
          <CardHeader>
            <CardTitle>Reward rules</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <RewardRulesForm current={rules} />
            {history.length > 1 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-bold text-on-surface-variant">Rule changes</summary>
                <ul className="mt-2 flex flex-col gap-1 text-xs text-on-surface-variant">
                  {history.map((h) => (
                    <li key={h.effectiveFrom.toISOString()}>
                      {formatDate(h.effectiveFrom.toISOString())}: {h.basePercent}% · {h.bonusPercent}% above ₹{h.bonusThreshold / 10_000_000} crore
                      {h.by ? ` · ${h.by.replace(/^staff:/, "")}` : ""}
                      {h.reason ? ` · ${h.reason}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {status && (
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <section className="rounded-xl border border-outline-variant p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-on-surface">Loan Managers App (LMS)</h2>
                {status.lms.awaitingReview > 0 ? (
                  <Badge variant="pending">Needs review</Badge>
                ) : status.lms.lastReceivedAt ? (
                  <Badge variant="success">Receiving</Badge>
                ) : (
                  <Badge variant="grey">Not connected yet</Badge>
                )}
              </div>
              <dl className="flex flex-col divide-y divide-outline-variant">
                <Row label="Last update">{when(status.lms.lastReceivedAt)}</Row>
                <Row label="Last 7 days">{status.lms.lastWeek}</Row>
                <Row label="Waiting to match">
                  {status.lms.awaitingReview > 0 ? (
                    <Link href="/dashboard/leads/lms-review" className="text-link underline underline-offset-4 hover:text-link-hover">
                      {status.lms.awaitingReview}
                    </Link>
                  ) : (
                    0
                  )}
                </Row>
              </dl>
            </section>

            <section className="rounded-xl border border-outline-variant p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-on-surface">AarthikLabs (ONDC)</h2>
                {!status.aarthik ? (
                  <Badge variant="grey">Can&apos;t check</Badge>
                ) : status.aarthik.healthy ? (
                  <Badge variant="success">Working</Badge>
                ) : (
                  <Badge variant="pending">Problem</Badge>
                )}
              </div>
              {status.aarthik ? (
                <dl className="flex flex-col divide-y divide-outline-variant">
                  <Row label="Status updates stuck over 15 min">{status.aarthik.outboxBacklogOver15Min}</Row>
                  <Row label="Being sent">{status.aarthik.webhooksInFlight}</Row>
                  <Row label="Failed">{status.aarthik.webhooksFailed}</Row>
                </dl>
              ) : (
                <p className="text-sm text-on-surface-variant">The server didn&apos;t answer. Status changes still queue up and go out once it&apos;s back.</p>
              )}
            </section>

            <section className="rounded-xl border border-outline-variant p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-on-surface">Partner API</h2>
                <Badge variant={status.apiKeys.active > 0 ? "success" : "grey"}>
                  {status.apiKeys.active > 0 ? "In use" : "No keys"}
                </Badge>
              </div>
              <dl className="flex flex-col divide-y divide-outline-variant">
                <Row label="Active keys">{status.apiKeys.active}</Row>
                <Row label="Last request">{when(status.apiKeys.lastUsedAt)}</Row>
              </dl>
              <p className="mt-3 text-xs text-on-surface-variant">
                Keys are issued and revoked on each partner&apos;s page in{" "}
                <Link href="/dashboard/partners" className="text-link underline underline-offset-4 hover:text-link-hover">Partners</Link>.
              </p>
            </section>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
