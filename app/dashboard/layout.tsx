import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { IntegrationHealthBanner } from "@/components/integration-health-banner";
import { staffAccess } from "@/lib/auth/session";
import { countPendingApplications } from "@/lib/partners/applications";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Belt and braces with middleware.ts, so a routing-config mistake cannot expose
  // borrower PII. Reads the live role (one small query), so a member who has been
  // turned off is signed out here rather than at their cookie's expiry.
  const staff = await staffAccess();
  const pendingApplications = staff.permissions.includes("partners.view") ? await countPendingApplications() : 0;

  return (
    <SidebarProvider>
      <AppSidebar
        staffName={staff.name}
        staffEmail={staff.email}
        role={staff.role}
        permissions={staff.permissions}
        pendingApplications={pendingApplications}
      />
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
