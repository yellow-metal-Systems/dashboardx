"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Building2, ExternalLink, MoreHorizontal, Phone } from "lucide-react";

import { cn } from "@/lib/utils";

// Icons by name: a server page (the lead page) can't hand a component to this client one.
const ICONS = { open: ExternalLink, phone: Phone, partner: Building2 };

export type MenuAction =
  | { kind: "link"; label: string; icon: keyof typeof ICONS; href: string }
  | { kind: "copy"; label: string; icon: keyof typeof ICONS; text: string; what: string };

/**
 * A "…" menu of quick actions (leads table rows, the lead page). A native
 * <details>, so it works with the keyboard; it closes on a click outside or Esc.
 */
export function ActionsMenu({ label, actions, className }: { label: string; actions: MenuAction[]; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [copied, setCopied] = useState("");
  const close = () => {
    if (ref.current) ref.current.open = false;
  };
  const onToggle = () => {
    const menu = ref.current;
    if (!menu?.open) return;
    // Listen only while open: up to 1000 rows must not each hold a document listener.
    const outside = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menu.contains(e.target as Node)) {
        menu.open = false;
        document.removeEventListener("click", outside);
        document.removeEventListener("keydown", outside);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", outside);
      document.addEventListener("keydown", outside);
    });
  };
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`${what} copied`);
    } catch {
      setCopied(`Could not copy the ${what.toLowerCase()}`);
    }
    close();
    setTimeout(() => setCopied(""), 2000);
  };
  const item = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-on-surface hover:bg-surface-container-low";
  return (
    <details ref={ref} onToggle={onToggle} className={cn("relative inline-block", className)}>
      <summary
        aria-label={label}
        className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 top-9 z-20 flex w-48 flex-col rounded-lg bg-surface-container-lowest p-1.5 shadow-e2 ring-1 ring-outline-variant">
        {actions.map((a) =>
          a.kind === "link" ? (
            <Link key={a.label} href={a.href} className={item}>
              <Icon name={a.icon} /> {a.label}
            </Link>
          ) : (
            <button key={a.label} type="button" className={item} onClick={() => copy(a.what, a.text)}>
              <Icon name={a.icon} /> {a.label}
            </button>
          )
        )}
      </div>
      <span role="status" className="sr-only">
        {copied}
      </span>
    </details>
  );
}

function Icon({ name }: { name: keyof typeof ICONS }) {
  const Component = ICONS[name];
  return <Component className="size-4 text-on-surface-variant" aria-hidden="true" />;
}
