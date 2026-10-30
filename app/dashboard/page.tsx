import { LeadsDashboard } from "@/components/leads/leads-dashboard";
import { countLmsToMatch, listLeads, listPartners } from "@/lib/leads-repo";
import { fetchBranchNames } from "@/lib/server-bridge";
import { staffAccess } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Leads" };

export default async function DashboardPage() {
  const [access, leads, partners, lmsToMatch, branchNames] = await Promise.all([
    staffAccess(),
    listLeads(),
    listPartners(),
    countLmsToMatch(),
    fetchBranchNames(),
  ]);
  const branches = Array.from(branchNames, ([id, b]) => ({ id, name: b.name }));
  return (
    <LeadsDashboard
      initialLeads={leads}
      partners={partners}
      branches={branches}
      // The LMS badge links to a page only some roles can open.
      lmsToMatch={access.permissions.includes("lms.resolve") ? lmsToMatch : 0}
      canUpdate={access.permissions.includes("leads.update")}
    />
  );
}
