import { redirect } from "next/navigation";

import { currentStaff } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — YellowMetal LeadDesk",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Already signed in: don't show a login form, go where they were headed.
  if (await currentStaff()) {
    const { next } = await searchParams;
    redirect(next && next.startsWith("/dashboard") ? next : "/dashboard");
  }

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

        <LoginForm />

        <p className="mt-6 text-center text-xs text-on-surface-variant">
          Staff access only. Lead records contain borrower personal information.
        </p>
      </div>
    </main>
  );
}
