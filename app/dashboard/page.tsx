import { LeadsDashboard } from "@/components/leads/leads-dashboard";
import { countLmsToMatch, listLeads, listPartners } from "@/lib/leads-repo";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [leads, partners, lmsToMatch] = await Promise.all([listLeads(), listPartners(), countLmsToMatch()]);
  return <LeadsDashboard initialLeads={leads} partners={partners} lmsToMatch={lmsToMatch} />;
}
