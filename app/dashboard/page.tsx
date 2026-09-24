import { LeadsDashboard } from "@/components/leads/leads-dashboard";
import { listLeads, listPartners } from "@/lib/leads-repo";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [leads, partners] = await Promise.all([listLeads(), listPartners()]);
  return <LeadsDashboard initialLeads={leads} partners={partners} />;
}
