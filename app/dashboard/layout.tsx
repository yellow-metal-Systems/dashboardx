import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { isDemoMode } from "@/lib/leads-repo";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {isDemoMode() && (
          <div
            role="status"
            className="border-b border-outline-variant bg-secondary-container px-4 py-1.5 text-center text-xs font-medium text-on-secondary-container"
          >
            Demo mode — showing example data, not connected to a database.
            Status changes are kept in memory only.
          </div>
        )}
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
