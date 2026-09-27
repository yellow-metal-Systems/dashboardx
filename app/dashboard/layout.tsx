import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireStaff } from "@/lib/auth/session";
import { fetchIntegrationHealth } from "@/lib/server-bridge";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Belt and braces with middleware.ts. Cheap (the session lives in the cookie,
  // so there is no query) and it means a routing-config mistake cannot expose
  // borrower PII.
  const staff = await requireStaff();

  // Null when the sibling service is unreachable or not configured — in which
  // case we simply say nothing rather than claim a problem.
  const health = await fetchIntegrationHealth();

  return (
    <SidebarProvider>
      <AppSidebar staffName={staff.name} staffEmail={staff.email} />
      <SidebarInset>
        {health && !health.healthy && (
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
        )}
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
