import { fetchIntegrationHealth } from "@/lib/server-bridge";

// Split out of DashboardLayout so it can stream in behind a <Suspense> boundary
// instead of blocking the whole page. fetchIntegrationHealth has a 4s timeout
// and was measured taking most of that on every request, which meant every
// staff page load waited on a banner the code itself documents as decorative.
export async function IntegrationHealthBanner() {
  const health = await fetchIntegrationHealth();
  if (!health || health.healthy) return null;

  return (
    <div
      role="status"
      className="border-b border-outline-variant bg-error-solid px-4 py-1.5 text-center text-xs font-bold text-white"
    >
      {health.outboxBacklogOver15Min > 0
        ? `${health.outboxBacklogOver15Min} status change${
            health.outboxBacklogOver15Min === 1 ? "" : "s"
          } have not reached AarthikLabs for over 15 minutes.`
        : `${health.webhooksFailed} status update${
            health.webhooksFailed === 1 ? "" : "s"
          } could not be delivered to AarthikLabs and need manual follow-up.`}
    </div>
  );
}
