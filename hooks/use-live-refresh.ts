"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Keeps a server-rendered page current without a manual browser reload.
//
// Leads arrive from two directions — staff working in this UI, and AarthikLabs
// posting to the partner API — and the second kind appears in the shared `leads`
// table with nothing to tell this browser about it. Before this, a lead that had
// genuinely landed was invisible until someone hit reload, which reads as "the
// integration is broken" even though the write had already happened.
//
// This polls rather than subscribing. A Postgres LISTEN/Realtime subscription
// would be more immediate, but it would mean a second connection path to the
// database from the browser and a vendor client this app otherwise does not use —
// a lot of moving parts for a table a handful of staff watch. router.refresh()
// re-runs the server component over the existing connection and reconciles in
// place, with no visible flicker and no scroll jump.

type Options = {
  /** Milliseconds between polls while the tab is visible. */
  intervalMs?: number;
  /** When false, polling pauses — e.g. while a mutation is in flight. */
  enabled?: boolean;
};

export type LiveRefresh = {
  /** When the server data was last known to be current. */
  lastRefreshedAt: Date;
  /** True while a refresh is in flight. */
  isRefreshing: boolean;
  /** Refresh now. Safe to call from a button. */
  refreshNow: () => void;
};

export function useLiveRefresh({ intervalMs = 30_000, enabled = true }: Options = {}): LiveRefresh {
  const router = useRouter();
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Held in a ref so changing it does not tear down and restart the interval.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const refreshNow = useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    setLastRefreshedAt(new Date());
    // router.refresh() gives no completion signal, so clear the indicator on a
    // short timer. It exists to show the click registered, not to gate anything.
    window.setTimeout(() => setIsRefreshing(false), 600);
  }, [router]);

  // Poll, but never in a background tab — a hidden tab polling the database all
  // afternoon is pure cost, and it refreshes on focus anyway.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!enabledRef.current) return;
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setLastRefreshedAt(new Date());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);

  // Coming back to the tab is the moment staleness matters most: someone has been
  // away, and whatever arrived while they were gone should be on screen already.
  useEffect(() => {
    function onFocus() {
      if (!enabledRef.current) return;
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setLastRefreshedAt(new Date());
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [router]);

  return { lastRefreshedAt, isRefreshing, refreshNow };
}

/** "just now" / "2m ago" — re-rendered by the caller's own tick. */
export function formatAge(from: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}
