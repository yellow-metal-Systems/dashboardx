"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { changePasswordAction, type PasswordFormState } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Change password"}
    </Button>
  );
}

export function ChangePasswordForm({ email }: { email: string }) {
  const [state, formAction] = useFormState<PasswordFormState, FormData>(changePasswordAction, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields once the new password is saved.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="max-w-md">
      {/* Lets password managers save the new password against the right email. */}
      <input type="hidden" name="username" autoComplete="username" value={email} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="current">Current password</FieldLabel>
          <FieldContent>
            <Input id="current" name="current" type="password" autoComplete="current-password" required />
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <FieldContent>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="text-xs text-on-surface-variant">At least 12 characters. A short phrase works well.</p>
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm">Confirm new password</FieldLabel>
          <FieldContent>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </FieldContent>
        </Field>
      </FieldGroup>

      <div aria-live="polite">
        {state.error && <p role="alert" className="mt-4 text-sm font-medium text-error">{state.error}</p>}
        {state.ok && <p className="mt-4 text-sm font-medium text-success">Password changed. Use the new one next time you sign in.</p>}
      </div>

      <div className="mt-5">
        <SubmitButton />
      </div>
    </form>
  );
}
