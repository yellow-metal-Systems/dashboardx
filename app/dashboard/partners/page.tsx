import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PARTNER_STATUS_BADGE_CLASSES, formatDate } from "@/lib/leads";
import { listPartnerSummaries } from "@/lib/leads-repo";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const partners = await listPartnerSummaries();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div>
        <h1 className="text-heading-lg text-on-surface">Partners</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          {partners.length} partner organization{partners.length === 1 ? "" : "s"}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 md:pt-9">
          {partners.length === 0 ? (
            <p className="py-10 text-center text-sm text-on-surface-variant">
              No partner organizations yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="[&>th]:whitespace-nowrap">
                  <TableHead>Organization</TableHead>
                  <TableHead>Contact email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Leads submitted</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-on-surface">{p.orgName}</TableCell>
                    <TableCell>
                      <a
                        href={`mailto:${p.contactEmail}`}
                        className="text-on-surface-variant hover:underline"
                      >
                        {p.contactEmail}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "border-transparent capitalize hover:bg-inherit",
                          PARTNER_STATUS_BADGE_CLASSES[p.status]
                        )}
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.leadCount === 0 ? (
                        <span className="text-on-surface-variant">—</span>
                      ) : (
                        p.leadCount
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(p.createdAt)}</TableCell>
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
