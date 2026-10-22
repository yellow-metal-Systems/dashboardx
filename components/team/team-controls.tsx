"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyField } from "@/components/partners/copy-field";
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/lib/auth/roles";
import {
  inviteMemberAction,
  revokeInviteAction,
  setMemberActiveAction,
  setMemberRoleAction,
  type TeamFormState,
} from "@/lib/team/actions";

const INITIAL: TeamFormState = { error: null };

function Pending({
  idle,
  busy,
  variant = "outline",
}: {
  idle: string;
  busy: string;
  variant?: "outline" | "dark" | "destructive";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

function FormError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-xs text-error">
      {error}
    </p>
  ) : null;
}

function RoleSelect({
  value,
  onChange,
  id,
  label = "Role",
}: {
  value: StaffRole | "";
  onChange: (r: StaffRole) => void;
  id?: string;
  label?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as StaffRole)}>
      <SelectTrigger id={id} aria-label={label}>
        <SelectValue placeholder="Choose a role" />
      </SelectTrigger>
      <SelectContent>
        {STAFF_ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Invite a colleague; the server returns a one-time link the admin copies (no email is sent yet). */
export function InviteMemberDialog() {
  const [open, setOpen] = useState(false);
  // Bumped on every open, so the form below starts empty instead of showing the last link.
  const [round, setRound] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setRound((r) => r + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="dark">
          <Plus /> Invite member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            They get a link to set a password for LeadDesk. It works once and
            expires in 7 days.
          </DialogDescription>
        </DialogHeader>
        <InviteMemberForm key={round} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function InviteMemberForm({ onDone }: { onDone: () => void }) {
  const [role, setRole] = useState<StaffRole | "">("");
  const [state, action] = useFormState<TeamFormState, FormData>(
    inviteMemberAction,
    INITIAL,
  );

  return state.inviteUrl ? (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-on-surface">
        Send this link to <b>{state.inviteFor}</b>:
      </p>
      <CopyField
        value={state.inviteUrl}
        label="Invite link"
        testId="invite-link"
      />
      <Button variant="outline" onClick={onDone}>
        Done
      </Button>
    </div>
  ) : (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="t-name">Name</FieldLabel>
          <FieldContent>
            <Input id="t-name" name="name" required />
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel htmlFor="t-email">Email (used to sign in)</FieldLabel>
          <FieldContent>
            <Input id="t-email" name="email" type="email" required />
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel htmlFor="t-role">Role</FieldLabel>
          <FieldContent>
            <RoleSelect id="t-role" value={role} onChange={setRole} />
          </FieldContent>
        </Field>
        <input type="hidden" name="role" value={role} />
      </FieldGroup>
      {state.error && (
        <p role="alert" className="mt-4 text-sm font-medium text-error">
          {state.error}
        </p>
      )}
      <div className="mt-6 flex justify-end">
        <Pending idle="Create invite link" busy="Creating…" variant="dark" />
      </div>
    </form>
  );
}

/** Pick a new role, then Save. The server refuses your own role and removing the last admin. */
export function MemberRole({
  memberId,
  name,
  role,
}: {
  memberId: string;
  name: string;
  role: StaffRole;
}) {
  const [next, setNext] = useState<StaffRole>(role);
  const [state, action] = useFormState<TeamFormState, FormData>(
    setMemberRoleAction,
    INITIAL,
  );
  return (
    <div className="flex flex-col gap-1">
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="memberId" value={memberId} />
        <input type="hidden" name="role" value={next} />
        <div className="w-48">
          <RoleSelect value={next} onChange={setNext} label={`Role for ${name}`} />
        </div>
        {next !== role && <Pending idle="Save" busy="Saving…" variant="dark" />}
      </form>
      <FormError error={state.error} />
    </div>
  );
}

/** Turning an account off signs it out at its next page load; its history stays. */
export function MemberActive({
  memberId,
  active,
}: {
  memberId: string;
  active: boolean;
}) {
  const [state, action] = useFormState<TeamFormState, FormData>(
    setMemberActiveAction,
    INITIAL,
  );
  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="memberId" value={memberId} />
        <input type="hidden" name="active" value={active ? "false" : "true"} />
        <Pending
          idle={active ? "Turn off" : "Turn back on"}
          busy="Saving…"
          variant={active ? "destructive" : "dark"}
        />
      </form>
      <FormError error={state.error} />
    </div>
  );
}

export function RevokeInvite({ inviteId }: { inviteId: string }) {
  const [state, action] = useFormState<TeamFormState, FormData>(
    revokeInviteAction,
    INITIAL,
  );
  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="inviteId" value={inviteId} />
        <Pending idle="Revoke" busy="Revoking…" variant="destructive" />
      </form>
      <FormError error={state.error} />
    </div>
  );
}
