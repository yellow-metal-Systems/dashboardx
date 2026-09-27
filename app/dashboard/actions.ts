"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads";
import { requireStaffOrThrow } from "@/lib/auth/session";
import { TerminalStatusError, updateLeadStatusRepo } from "@/lib/leads-repo";

const statusSchema = z.enum(LEAD_STATUSES);

const disbursementSchema = z.object({
  loanId: z.string().trim().min(1).max(64).optional(),
  amount: z.number().positive().max(1_000_000_000).optional(),
  // A DATE, so no timezone can shift it.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Disbursement date must be YYYY-MM-DD")
    .optional(),
  tenure: z.number().int().positive().max(600).optional(),
});

export type UpdateStatusResult = { ok: true } | { ok: false; error: string };

/**
 * Changes a lead's status.
 *
 * requireStaffOrThrow() is the check that matters. middleware.ts guards the
 * /dashboard routes, but a server action is a directly invokable POST endpoint —
 * a middleware- or layout-only guard would leave this mutation open to anyone who
 * knows the action id.
 */
export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
  disbursement?: z.input<typeof disbursementSchema>
): Promise<UpdateStatusResult> {
  const staff = await requireStaffOrThrow();

  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { ok: false, error: `Unknown status: ${String(status)}` };
  }

  let details: z.infer<typeof disbursementSchema> | undefined;
  if (disbursement) {
    const parsed = disbursementSchema.safeParse(disbursement);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid disbursement details." };
    }
    details = parsed.data;
  }

  // Recording a disbursal without an amount would send AarthikLabs a DISBURSED
  // webhook carrying nulls — which is what happened before any UI collected these.
  if (parsedStatus.data === "DISBURSED" && details?.amount === undefined) {
    return {
      ok: false,
      error: "Enter the disbursed amount before marking this lead as disbursed.",
    };
  }

  try {
    await updateLeadStatusRepo(id, parsedStatus.data, staff.email, details);
  } catch (error) {
    if (error instanceof TerminalStatusError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${id}`);
  revalidatePath("/dashboard/overview");
  revalidatePath("/dashboard/partners");

  return { ok: true };
}
