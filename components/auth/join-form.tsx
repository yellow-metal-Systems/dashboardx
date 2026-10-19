"use client";

import { useFormState, useFormStatus } from "react-dom";

import { acceptStaffInviteAction, type JoinState } from "@/lib/team/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

/** Sets the password for an invited colleague; on success the action redirects to /login?joined=1. */
export function JoinForm({ token, email }: { token: string; email: string }) {
  const [state, formAction] = useFormState<JoinState, FormData>(acceptStaffInviteAction, { error: null });

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="token" value={token} />
      {/* Lets password managers save the new login against the right email. */}
      <input type="hidden" name="username" autoComplete="username" value={email} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <FieldContent>
            <Input id="password" name="password" type="password" autoComplete="new-password" required autoFocus />
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
          <FieldContent>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </FieldContent>
        </Field>
      </FieldGroup>

      {state.error && (
        <p role="alert" className="mt-4 text-sm font-medium text-error">
          {state.error}
        </p>
      )}

      <div className="mt-6">
        <SubmitButton />
      </div>
    </form>
  );
}
