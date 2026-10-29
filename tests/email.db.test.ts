import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { sendEmail } from "@/lib/email";
import { getEmail, listEmails } from "@/lib/email-log";
import { agreementSent, approved, rejected } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";

// Onboarding emails sent from LeadDesk, and the "Sent emails" page's data
// (plan of 27 Oct 2026). The sending logic itself is tested in LeadBridge,
// which has the same lib/email.ts. SKIPS without TEST_DATABASE_URL.
const db = process.env.TEST_DATABASE_URL?.trim() ? describe : describe.skip;

describe("onboarding email templates", () => {
  it("the agreement email carries the link, the expiry in IST and the right agreement", () => {
    const e = agreementSent({
      name: "Suresh <G>",
      template: "BC",
      link: "https://lb.example/agreement/tok?x=1&y=2",
      expiresAt: new Date("2026-11-10T12:30:00Z"),
      resent: false,
    });
    expect(e.subject).toBe("Please sign your Yellow Metal Business Correspondent (BC) Agreement");
    expect(e.html).toContain("Suresh &lt;G&gt;");
    expect(e.html).toContain('href="https://lb.example/agreement/tok?x=1&amp;y=2"');
    expect(e.text).toContain("https://lb.example/agreement/tok?x=1&y=2");
    expect(e.text).toContain("10 Nov 2026, 6:00 pm IST");
    expect(agreementSent({ name: "M", template: "DSA", link: "l", expiresAt: new Date(), resent: true }).text).toContain(
      "no longer works",
    );
  });

  it("the approval and rejection emails", () => {
    const a = approved({ name: "Meena", template: "DSA", inviteLink: "https://lb.example/invite/abc", inviteDays: 7, installLink: "https://lb.example/install" });
    expect(a.text).toContain("countersigned your Direct Selling Agent (DSA) Agreement");
    expect(a.text).toContain("https://lb.example/invite/abc");
    expect(rejected({ name: "S", reason: "Outside our <area>" }).html).toContain("Outside our &lt;area&gt;");
  });
});

db("sent emails (database)", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE email_messages`);
    delete process.env.EMAIL_MODE;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists the newest first and shows a logged email's body", async () => {
    const first = await sendEmail({ to: "a@example.com", template: "rejected", ...rejected({ name: "A", reason: "r" }) });
    await new Promise((r) => setTimeout(r, 5));
    await sendEmail({ to: "b@example.com", template: "rejected", ...rejected({ name: "B", reason: "r" }) });

    const { mode, emails } = await listEmails();
    expect(mode).toBe("log");
    expect(emails.map((e) => e.toAddress)).toEqual(["b@example.com", "a@example.com"]);
    expect(emails[0]).not.toHaveProperty("bodyHtml");

    const one = await getEmail(first.id);
    expect(one?.bodyHtml).toContain("Hi A,");
    expect(await getEmail("missing")).toBeNull();
  });
});
