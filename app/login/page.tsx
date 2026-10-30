import Image from "next/image";
import { redirect } from "next/navigation";

import { currentStaff, safeNextPath } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";
import { PreprodBanner } from "@/components/preprod-banner";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; joined?: string }>;
}) {
  const { joined, next } = await searchParams;
  // Already signed in: don't show a login form, go where they were headed.
  if (await currentStaff()) redirect(safeNextPath(next));

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <PreprodBanner className="mb-6 rounded-lg" />
        <div className="mb-8 text-center">
          <Image src="/ym-logo.png" alt="YellowMetal" width={719} height={312} sizes="176px" priority className="mx-auto h-auto w-44" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
            LeadDesk
          </p>
        </div>

        {joined === "1" && (
          <p role="status" className="mb-4 rounded-lg bg-success-soft p-3 text-center text-sm font-bold text-on-success-soft">
            Account created, sign in
          </p>
        )}

        <LoginForm next={safeNextPath(next)} />

        <p className="mt-6 text-center text-xs text-on-surface-variant">
          Staff access only. Lead records contain borrower personal information.
        </p>
      </div>
    </main>
  );
}
