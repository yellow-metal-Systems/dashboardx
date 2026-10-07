"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Inbox, LayoutDashboard, LogOut, Settings, Wallet } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
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
  { title: "Partners", href: "/dashboard/partners", icon: Building2, prefixes: ["/dashboard/partners/"] },
  { title: "Rewards", href: "/dashboard/rewards", icon: Wallet, prefixes: [] },
  { title: "Overview", href: "/dashboard/overview", icon: LayoutDashboard, prefixes: [] },
];

type Props = {
  staffName: string;
  staffEmail: string;
};

export function AppSidebar({ staffName, staffEmail }: Props) {
  const pathname = usePathname();

  function isActive(item: (typeof NAV_ITEMS)[number]) {
    return pathname === item.href || item.prefixes.some((p) => pathname.startsWith(p));
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex flex-col gap-3 px-2 py-1.5">
          <span className="font-serif text-lg italic tracking-tight text-sidebar-primary">
            Yellow
            <span className="font-semibold not-italic text-sidebar-foreground">Metal</span>
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
      {/*
        There is no partner-facing route. Partner authentication, invitations and
        real lead submission are a separate piece of work — see docs/TODO.md. An
        earlier static mock at /partner was removed rather than left implying a
        working portal.
      */}
      <SidebarFooter>
        <div className="px-2 py-1.5">
          <p className="truncate text-xs font-semibold text-sidebar-foreground" title={staffName}>
            {staffName}
          </p>
          <p className="truncate text-[11px] text-sidebar-muted" title={staffEmail}>
            {staffEmail}
          </p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signOut}>
              <SidebarMenuButton asChild>
                <button type="submit" className="w-full">
                  <LogOut />
                  <span>Sign out</span>
                </button>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-2 py-1.5 text-xs text-sidebar-muted">YellowMetal LeadDesk</p>
      </SidebarFooter>
    </Sidebar>
  );
}
