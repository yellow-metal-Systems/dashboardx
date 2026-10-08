"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveLmsEventAction, type ResolveState } from "@/lib/lms-actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="dark" disabled={pending}>
      {pending ? "Applying…" : "Apply to this lead"}
    </Button>
  );
}

/** Pick the lead an unmatched LMS update belongs to: one of the same-mobile leads, or any YMLEAD number. */
export function LmsResolveForm({ eventId, candidates }: { eventId: string; candidates: { id: string; name: string; status: string }[] }) {
  const [state, action] = useFormState<ResolveState, FormData>(resolveLmsEventAction, { error: null });
  const [leadId, setLeadId] = useState("");
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      {candidates.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Leads with this mobile">
          {candidates.map((c) => (
            <Button key={c.id} type="button" size="sm" variant={leadId === c.id ? "dark" : "outline"} onClick={() => setLeadId(c.id)}>
              {c.name} · {c.status}
            </Button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input name="leadId" value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="YMLEAD0000012345" aria-label="Lead number" className="w-full font-mono sm:w-64" />
        <Submit />
      </div>
      {state.error && <p role="alert" className="text-xs text-error">{state.error}</p>}
    </form>
  );
}
