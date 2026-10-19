import Link from "next/link";

import { JoinForm } from "@/components/auth/join-form";
import { Card, CardContent } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { findInvite } from "@/lib/team/team";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Join — YellowMetal LeadDesk",
};

// Public on purpose: the middleware only guards /dashboard, and the token is the credential.
export default async function JoinPage({ params }: { params: { token: string } }) {
  const invite = await findInvite(params.token);

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-serif text-2xl italic tracking-tight text-primary">
            Yellow
            <span className="font-semibold not-italic text-on-surface">Metal</span>
          </span>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
            LeadDesk
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 md:pt-9">
            {invite ? (
              <>
                <h1 className="text-heading-lg text-on-surface">Join LeadDesk as {ROLE_LABELS[invite.role]}</h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Hi {invite.name}, set a password for <b className="text-on-surface">{invite.email}</b>. You&apos;ll sign in with this email.
                </p>
                <JoinForm token={params.token} email={invite.email} />
              </>
            ) : (
              <>
                <h1 className="text-heading-lg text-on-surface">This link doesn&apos;t work</h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  It has expired or was already used. Ask an admin for a new invite link.
                </p>
                <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-on-surface underline">
                  Go to sign in
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
