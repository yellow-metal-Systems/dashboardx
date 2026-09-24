"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Handshake,
  Inbox,
  LayoutDashboard,
  Settings,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { title: "Leads", href: "/dashboard", icon: Inbox, prefixes: ["/dashboard/leads"] },
  { title: "Partners", href: "/dashboard/partners", icon: Building2, prefixes: [] },
  { title: "Overview", href: "/dashboard/overview", icon: LayoutDashboard, prefixes: [] },
];

export function AppSidebar() {
  const pathname = usePathname();

  function isActive(item: (typeof NAV_ITEMS)[number]) {
    return (
      pathname === item.href || item.prefixes.some((p) => pathname.startsWith(p))
    );
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex flex-col gap-3 px-2 py-1.5">
          <span className="font-serif text-lg italic tracking-tight text-sidebar-primary">
            Yellow<span className="not-italic font-semibold text-sidebar-foreground">Metal</span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
            Workspace
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item)}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  disabled
                  aria-disabled="true"
                  title="Settings are not available yet"
                >
                  <Settings />
                  <span>Settings</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-sidebar-muted">
                    Soon
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/partner"}>
              <Link href="/partner">
                <Handshake />
                <span>Partner App</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-2 py-1.5 text-xs text-sidebar-muted">YellowMetal LeadDesk</p>
      </SidebarFooter>
    </Sidebar>
  );
}
