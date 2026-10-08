"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createApiKeyAction,
  resendInviteAction,
  revokeApiKeyAction,
  setGstinRequiredAction,
  setPartnerEnabledAction,
  type FormState,
  type KeyFormState,
} from "@/lib/partners/actions";
import { CopyField } from "./copy-field";

function Pending({ idle, busy, variant = "outline" }: { idle: string; busy: string; variant?: "outline" | "dark" | "destructive" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

/** New single-use invite link for a login that hasn't set a password (or forgot it). */
export function ResendInvite({ partnerUserId, name }: { partnerUserId: string; name: string }) {
  const [state, action] = useFormState<FormState, FormData>(resendInviteAction, { error: null });
  return (
    <div className="flex flex-col gap-2">
      <form action={action}>
        <input type="hidden" name="partnerUserId" value={partnerUserId} />
        <input type="hidden" name="name" value={name} />
        <Pending idle="New invite link" busy="Creating…" />
      </form>
      {state.inviteUrl && <CopyField value={state.inviteUrl} label={`Invite link for ${name}`} testId="invite-link" />}
      {state.error && <p role="alert" className="text-xs text-error">{state.error}</p>}
    </div>
  );
}

/** Whether this partner's leads must include the customer's GSTIN (serverx enforces it). */
export function GstinRequiredToggle({ partnerId, required }: { partnerId: string; required: boolean }) {
  return (
    <form action={setGstinRequiredAction} className="flex items-center gap-3 text-sm">
      <input type="hidden" name="partnerId" value={partnerId} />
      <input type="hidden" name="required" value={required ? "false" : "true"} />
      <span className="text-on-surface">Customer&apos;s GSTIN on leads: <b>{required ? "required" : "optional"}</b></span>
      <Pending idle={required ? "Make optional" : "Require it"} busy="Saving…" />
    </form>
  );
}

/** Turning a partner off blocks its logins, new leads and API keys; its leads stay. */
export function TogglePartner({ partnerId, enabled }: { partnerId: string; enabled: boolean }) {
  return (
    <form action={setPartnerEnabledAction}>
      <input type="hidden" name="partnerId" value={partnerId} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <Pending idle={enabled ? "Turn off" : "Turn back on"} busy="Saving…" variant={enabled ? "destructive" : "dark"} />
    </form>
  );
}

export function CreateApiKey({ partnerId }: { partnerId: string }) {
  const [state, action] = useFormState<KeyFormState, FormData>(createApiKeyAction, { error: null });
  return (
    <div className="flex flex-col gap-2">
      <form action={action} className="flex gap-2">
        <input type="hidden" name="partnerId" value={partnerId} />
        <Input name="label" placeholder="Key name, e.g. Production" aria-label="Key name" required className="max-w-xs" />
        <Pending idle="Create API key" busy="Creating…" variant="dark" />
      </form>
      {state.key && (
        <div className="flex flex-col gap-2 rounded-lg bg-success-soft p-3" role="status">
          <span className="text-sm font-bold text-on-success-soft">Copy this key now and send it securely. It is shown only once.</span>
          <CopyField value={state.key} label="New API key" testId="api-key" />
        </div>
      )}
      {state.error && <p role="alert" className="text-xs text-error">{state.error}</p>}
    </div>
  );
}

export function RevokeApiKey({ keyId }: { keyId: string }) {
  return (
    <form action={revokeApiKeyAction}>
      <input type="hidden" name="keyId" value={keyId} />
      <Pending idle="Revoke" busy="Revoking…" variant="destructive" />
    </form>
  );
}
