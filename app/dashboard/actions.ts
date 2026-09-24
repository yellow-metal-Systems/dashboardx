"use server";

import { revalidatePath } from "next/cache";

import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads";
import { updateLeadStatusRepo } from "@/lib/leads-repo";

export async function updateLeadStatus(id: string, status: LeadStatus) {
  if (!LEAD_STATUSES.includes(status)) {
    throw new Error(`Invalid lead status: ${String(status)}`);
  }

  await updateLeadStatusRepo(id, status);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${id}`);
  revalidatePath("/dashboard/overview");
}
