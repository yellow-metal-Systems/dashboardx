import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { IntegrationHealthBanner } from "@/components/integration-health-banner";
import { requireStaff } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Belt and braces with middleware.ts. Cheap (the session lives in the cookie,
  // so there is no query) and it means a routing-config mistake cannot expose
  // borrower PII.
  const staff = await requireStaff();

  return (
    <SidebarProvider>
      <AppSidebar staffName={staff.name} staffEmail={staff.email} />
      <SidebarInset>
        {/* fetchIntegrationHealth was measured taking ~3s of every page's TTFB
            (its own 4s timeout ceiling) when awaited here directly. It's
            decorative — nothing else on the page depends on it — so it streams
            in behind Suspense instead of blocking the whole page. */}
        <Suspense fallback={null}>
          <IntegrationHealthBanner />
        </Suspense>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
