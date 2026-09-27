"use client";

// React 18 + Next 14: the hook is useFormState from react-dom. (useActionState is
// the React 19 name for it and does not exist here.)
import { useFormState, useFormStatus } from "react-dom";

import { signIn, type LoginState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";

function SubmitButton() {
  // Without a pending state the form stays submittable, and a slow password hash
  // (deliberately ~100ms+) invites double submission.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const [state, formAction] = useFormState<LoginState, FormData>(signIn, { error: null });

  return (
    <Card>
      <CardContent className="pt-6 md:pt-9">
        <h1 className="text-heading-lg text-on-surface">Sign in</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Use the account your administrator created for you.
        </p>

        {demoMode && (
          <p
            role="status"
            className="mt-4 rounded-md bg-secondary-container px-3 py-2 text-xs font-medium text-on-secondary-container"
          >
            Demo mode — any email and password will sign you in, and all data shown
            afterwards is example data.
          </p>
        )}

        <form action={formAction} className="mt-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <FieldContent>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus
                  placeholder="you@yellowmetal.example"
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <FieldContent>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
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
      </CardContent>
    </Card>
  );
}
