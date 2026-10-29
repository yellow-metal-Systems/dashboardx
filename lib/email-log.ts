import { prisma } from "@/lib/prisma";
import { emailMode } from "@/lib/email";

// The "Sent emails" page (admin only): every email LeadDesk and LeadBridge sent
// or, in log mode, only recorded. In log mode this is the demo mailbox: the body
// and its links are shown so the flow can be followed without a mail service.

export type EmailRow = {
  id: string;
  toAddress: string;
  template: string;
  subject: string;
  status: string;
  error: string | null;
  applicationId: string | null;
  createdAt: Date;
};

export async function listEmails(limit = 100): Promise<{ mode: "log" | "resend"; emails: EmailRow[] }> {
  const emails = await prisma.emailMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 500),
    select: { id: true, toAddress: true, template: true, subject: true, status: true, error: true, applicationId: true, createdAt: true },
  });
  return { mode: emailMode(), emails };
}

/** One email, with its body when it was only logged (null for real sends: the body is never stored). */
export async function getEmail(id: string): Promise<(EmailRow & { bodyHtml: string | null }) | null> {
  return prisma.emailMessage.findUnique({
    where: { id },
    select: {
      id: true,
      toAddress: true,
      template: true,
      subject: true,
      status: true,
      error: true,
      applicationId: true,
      createdAt: true,
      bodyHtml: true,
    },
  });
}
