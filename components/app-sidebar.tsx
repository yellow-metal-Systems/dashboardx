"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronUp, ClipboardCheck, Inbox, LayoutDashboard, LogOut, Settings, UserCog, Users, Wallet } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { ROLE_LABELS, type Permission, type StaffRole } from "@/lib/auth/roles";
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

// Each item shows only for roles holding its permission; the page itself 404s regardless.
const NAV_ITEMS: { title: string; href: string; icon: typeof Inbox; permission: Permission; prefixes: string[] }[] = [
  { title: "Leads", href: "/dashboard", icon: Inbox, permission: "leads.view", prefixes: ["/dashboard/leads"] },
  { title: "LMS review", href: "/dashboard/leads/lms-review", icon: ClipboardCheck, permission: "lms.resolve", prefixes: [] },
  { title: "Partners", href: "/dashboard/partners", icon: Building2, permission: "partners.view", prefixes: ["/dashboard/partners/"] },
  { title: "Rewards", href: "/dashboard/rewards", icon: Wallet, permission: "rewards.view", prefixes: ["/dashboard/rewards/"] },
  { title: "Team", href: "/dashboard/team", icon: Users, permission: "team.manage", prefixes: [] },
  // Overview lists top partners, so it follows partners.view (admins), like Partners.
  { title: "Overview", href: "/dashboard/overview", icon: LayoutDashboard, permission: "partners.view", prefixes: [] },
];

type Props = {
  staffName: string;
  staffEmail: string;
  role: StaffRole;
  permissions: Permission[];
};

export function AppSidebar({ staffName, staffEmail, role, permissions }: Props) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => permissions.includes(item.permission));

  // Longest match wins, so /dashboard/leads/lms-review lights "LMS review", not "Leads".
  const matchLength = (item: (typeof NAV_ITEMS)[number]) =>
    Math.max(
      pathname === item.href ? item.href.length : 0,
      ...item.prefixes.map((p) => (pathname.startsWith(p) ? p.length : 0)),
    );
  const activeHref = items.reduce<{ href: string; len: number }>(
    (best, item) => (matchLength(item) > best.len ? { href: item.href, len: matchLength(item) } : best),
    { href: "", len: 0 },
  ).href;

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
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={item.href === activeHref}>
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
        {/* Profile menu (standup 2026-10-15): click the name to see the account and, for admins, Manage team. */}
        <details className="group rounded-md">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground"
            >
              {staffName.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-sidebar-foreground" title={staffName}>
                {staffName}
              </span>
              <span className="block truncate text-[11px] text-sidebar-muted">{ROLE_LABELS[role]}</span>
            </span>
            <ChevronUp aria-hidden="true" className="size-4 shrink-0 text-sidebar-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-1 px-2 pb-1.5 pt-1">
            <p className="truncate text-[11px] text-sidebar-muted" title={staffEmail}>
              {staffEmail}
            </p>
            {permissions.includes("team.manage") && (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/dashboard/team")}>
                    <Link href="/dashboard/team">
                      <UserCog />
                      <span>Manage team</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}
          </div>
        </details>
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
