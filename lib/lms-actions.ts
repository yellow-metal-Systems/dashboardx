"use server";

import { revalidatePath } from "next/cache";

import { requirePermissionOrThrow } from "@/lib/auth/session";
import { resolveLmsEvent } from "@/lib/server-bridge";

export type ResolveState = { error: string | null; ok?: boolean };

/**
 * Staff pick the lead for an LMS update that couldn't be matched. Matching is an
 * operations task (lms.resolve); approving any resulting reward needs rewards.manage.
 */
export async function resolveLmsEventAction(_prev: ResolveState, fd: FormData): Promise<ResolveState> {
  const staff = await requirePermissionOrThrow("lms.resolve");
  const eventId = String(fd.get("eventId") ?? "");
  const leadId = String(fd.get("leadId") ?? "").trim().toUpperCase();
  if (!/^YMLEAD\d{10}$/.test(leadId)) return { error: "Enter the lead's YMLEAD number, e.g. YMLEAD0000012345." };
  const res = await resolveLmsEvent(eventId, leadId, `staff:${staff.email}`);
  if (!res.ok) return { error: res.error };
  revalidatePath("/dashboard", "layout");
  return { error: null, ok: true };
}
