import { fetchIntegrationHealth } from "@/lib/server-bridge";

// Split out of DashboardLayout so it can stream in behind a <Suspense> boundary
// instead of blocking the whole page. fetchIntegrationHealth has a 4s timeout
// and was measured taking most of that on every request, which meant every
// staff page load waited on a banner the code itself documents as decorative.
export async function IntegrationHealthBanner() {
  const health = await fetchIntegrationHealth();
  if (!health || health.healthy) return null;

  return (
    // Floats over the page rather than sitting above it: it streams in after the
    // page has painted, and pushing everything down then made the page jump.
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-error-solid px-4 py-2 text-center text-xs font-bold text-white shadow-e3"
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
