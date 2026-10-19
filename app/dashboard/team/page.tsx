import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InviteMemberDialog, MemberActive, MemberRole, RevokeInvite } from "@/components/team/team-controls";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { PARTNER_STATUS_BADGE_CLASSES, formatDate, formatDateTime } from "@/lib/leads";
import { listTeam } from "@/lib/team/team";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const access = await requirePermission("team.manage");
  const { members, invites } = await listTeam();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading-lg text-on-surface">Team</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Who can sign in to LeadDesk and what their role allows · {members.filter((m) => m.isActive).length} active
          </p>
        </div>
        <InviteMemberDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="[&>th]:whitespace-nowrap">
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="text-right">Account</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const self = m.id === access.userId;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium text-on-surface">
                      {m.name}
                      {self && <span className="ml-1 text-xs text-on-surface-variant">(you)</span>}
                      <span className="block text-xs font-normal text-on-surface-variant">{m.email}</span>
                    </TableCell>
                    <TableCell>
                      {/* The server refuses changing your own role or account; don't offer it. */}
                      {self ? ROLE_LABELS[m.role] : <MemberRole memberId={m.id} role={m.role} />}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border-transparent", PARTNER_STATUS_BADGE_CLASSES[m.isActive ? "active" : "disabled"])}>
                        {m.isActive ? "Active" : "Turned off"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {m.lastLoginAt ? formatDateTime(m.lastLoginAt.toISOString()) : "Never"}
                    </TableCell>
                    <TableCell className="text-right">{!self && <MemberActive memberId={m.id} active={m.isActive} />}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invites</CardTitle>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="py-6 text-center text-sm text-on-surface-variant">No pending invites.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="[&>th]:whitespace-nowrap">
                  <TableHead>Invited</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Link expires</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium text-on-surface">
                      {i.name}
                      <span className="block text-xs font-normal text-on-surface-variant">{i.email}</span>
                    </TableCell>
                    <TableCell>{ROLE_LABELS[i.role]}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(i.expiresAt.toISOString())}</TableCell>
                    <TableCell className="text-right"><RevokeInvite inviteId={i.id} /></TableCell>
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
