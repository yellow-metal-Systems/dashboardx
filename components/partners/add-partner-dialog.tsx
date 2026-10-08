"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { addPartnerAction, type FormState } from "@/lib/partners/actions";
import { cn } from "@/lib/utils";
import { CopyField } from "./copy-field";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="dark" disabled={pending}>
      {pending ? "Adding…" : "Add partner and create invite"}
    </Button>
  );
}

/** Add a lead generator or an organisation; returns a one-time invite link to send them. */
export function AddPartnerDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"INDIVIDUAL" | "ORGANISATION">("INDIVIDUAL");
  const [state, action] = useFormState<FormState, FormData>(addPartnerAction, { error: null });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="dark">
          <Plus /> Add partner
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add partner</DialogTitle>
          <DialogDescription>They get a link to set a password in the LeadBridge app. It works once and expires in 7 days.</DialogDescription>
        </DialogHeader>

        {state.inviteUrl ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-on-surface">
              Send this link to <b>{state.inviteFor}</b> on WhatsApp or SMS:
            </p>
            <CopyField value={state.inviteUrl} label="Invite link" testId="invite-link" />
            <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <form action={action}>
            <FieldGroup>
              <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-container-low p-1" role="radiogroup" aria-label="Partner type">
                {(["INDIVIDUAL", "ORGANISATION"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={type === t}
                    onClick={() => setType(t)}
                    className={cn("h-9 rounded-full text-sm font-bold", type === t ? "bg-raised shadow-e1" : "text-on-surface-variant")}
                  >
                    {t === "INDIVIDUAL" ? "Individual" : "Organisation"}
                  </button>
                ))}
              </div>
              <input type="hidden" name="type" value={type} />
              {type === "ORGANISATION" && (
                <Field>
                  <FieldLabel htmlFor="p-org">Organisation name</FieldLabel>
                  <FieldContent><Input id="p-org" name="orgName" placeholder="Finance Buddha" required /></FieldContent>
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="p-name">{type === "ORGANISATION" ? "Contact person" : "Name"}</FieldLabel>
                <FieldContent><Input id="p-name" name="personName" required /></FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="p-mobile">Mobile (used to sign in)</FieldLabel>
                <FieldContent><Input id="p-mobile" name="mobile" inputMode="tel" placeholder="98765 43210" required /></FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="p-email">Email</FieldLabel>
                <FieldContent><Input id="p-email" name="email" type="email" required /></FieldContent>
              </Field>
              <label className="flex items-center gap-2 text-sm text-on-surface">
                <input type="checkbox" name="isOndc" className="size-4 accent-black" /> ONDC participant
              </label>
              <label className="flex items-center gap-2 text-sm text-on-surface">
                <input type="checkbox" name="gstinRequired" className="size-4 accent-black" /> Customer&apos;s GSTIN required on every lead
              </label>
            </FieldGroup>
            {state.error && <p role="alert" className="mt-4 text-sm font-medium text-error">{state.error}</p>}
            <div className="mt-6 flex justify-end"><Submit /></div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
