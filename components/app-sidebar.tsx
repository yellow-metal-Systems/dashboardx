"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronUp, ClipboardCheck, Inbox, LayoutDashboard, LogOut, Mail, Settings, UserCog, Users, Wallet } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { ROLE_LABELS, type Permission, type StaffRole } from "@/lib/auth/roles";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// Each item shows only for roles holding its permission; the page itself 404s regardless.
// Grouped like the reference sidebar: what a section is for reads before its items.
const SECTIONS = ["Leads", "Partners", "Admin"] as const;

const NAV_ITEMS: { title: string; href: string; icon: typeof Inbox; permission: Permission; prefixes: string[]; section: (typeof SECTIONS)[number] }[] = [
  { title: "Leads", href: "/dashboard", icon: Inbox, permission: "leads.view", prefixes: ["/dashboard/leads"], section: "Leads" },
  { title: "LMS review", href: "/dashboard/leads/lms-review", icon: ClipboardCheck, permission: "lms.resolve", prefixes: [], section: "Leads" },
  { title: "Partners", href: "/dashboard/partners", icon: Building2, permission: "partners.view", prefixes: ["/dashboard/partners/"], section: "Partners" },
  // The onboarding emails; in demo (log) mode, the mailbox the flow is followed from.
  { title: "Sent emails", href: "/dashboard/emails", icon: Mail, permission: "partners.manage", prefixes: ["/dashboard/emails/"], section: "Partners" },
  { title: "Rewards", href: "/dashboard/rewards", icon: Wallet, permission: "rewards.view", prefixes: ["/dashboard/rewards/"], section: "Partners" },
  { title: "Team", href: "/dashboard/team", icon: Users, permission: "team.manage", prefixes: [], section: "Admin" },
  // Overview lists top partners, so it follows partners.view (admins), like Partners.
  { title: "Overview", href: "/dashboard/overview", icon: LayoutDashboard, permission: "partners.view", prefixes: [], section: "Admin" },
];

type Props = {
  staffName: string;
  staffEmail: string;
  role: StaffRole;
  permissions: Permission[];
  /** Applications waiting on an admin (new + signed), shown on Partners. */
  pendingApplications: number;
  /** Sent emails is the demo mailbox: only while emails are logged, not sent (EMAIL_MODE=log). */
  showSentEmails: boolean;
};

export function AppSidebar({ staffName, staffEmail, role, permissions, pendingApplications, showSentEmails }: Props) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (item) => permissions.includes(item.permission) && (item.href !== "/dashboard/emails" || showSentEmails)
  );

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
          <Image src="/ym-logo.png" alt="YellowMetal" width={719} height={312} sizes="128px" priority className="h-auto w-32" />
          <span className="text-xs font-semibold uppercase tracking-widest text-sidebar-muted">
            Workspace
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Main">
          {SECTIONS.map((section) => {
            const list = items.filter((item) => item.section === section);
            // Every member has Settings (their own account), so Admin always shows.
            if (list.length === 0 && section !== "Admin") return null;
            return (
              <SidebarGroup key={section} className="py-1">
                <SidebarGroupLabel className="h-7 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-sidebar-muted">
                  {section}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {list.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={item.href === activeHref}>
                          <Link href={item.href} aria-current={item.href === activeHref ? "page" : undefined}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                        {item.href === "/dashboard/partners" && pendingApplications > 0 && (
                          <SidebarMenuBadge>
                            {pendingApplications}
                            <span className="sr-only"> applications waiting</span>
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    ))}
                    {section === "Admin" && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname.startsWith("/dashboard/settings")}>
                          <Link href="/dashboard/settings" aria-current={pathname.startsWith("/dashboard/settings") ? "page" : undefined}>
                            <Settings />
                            <span>Settings</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </nav>
      </SidebarContent>
      {/* Partners sign in and submit leads in the separate LeadBridge app, not here. */}
      <SidebarFooter>
        {/* Profile menu (standup 2026-10-15): click the name to see the account and, for admins, Manage team. */}
        <details className="group rounded-md">
          <summary
            aria-label={`Account menu: ${staffName}, ${ROLE_LABELS[role]}`}
            className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent [&::-webkit-details-marker]:hidden">
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
              <span className="block truncate text-xs text-sidebar-muted">{ROLE_LABELS[role]}</span>
            </span>
            <ChevronUp aria-hidden="true" className="size-4 shrink-0 text-sidebar-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-1 px-2 pb-1.5 pt-1">
            <p className="truncate text-xs text-sidebar-muted" title={staffEmail}>
              {staffEmail}
            </p>
            {permissions.includes("team.manage") && (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/dashboard/team")}>
                    <Link href="/dashboard/team" aria-current={pathname.startsWith("/dashboard/team") ? "page" : undefined}>
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
