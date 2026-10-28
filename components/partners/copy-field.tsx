"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** A read-only value with a copy button — invite links and new API keys. */
export function CopyField({ value, label, testId }: { value: string; label: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // navigator.clipboard is missing on plain-http origins (LeadDesk opened by LAN IP):
  // then select the text so it can be copied by hand.
  function copy() {
    if (!navigator.clipboard) return inputRef.current?.select();
    navigator.clipboard.writeText(value).then(
      () => setCopied(true),
      () => inputRef.current?.select()
    );
  }

  return (
    <div className="flex gap-2">
      <Input ref={inputRef} readOnly value={value} aria-label={label} data-testid={testId} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button type="button" variant="outline" onClick={copy}>
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
        <span className="sr-only"> {label}</span>
      </Button>
      <span role="status" className="sr-only">
        {copied ? `${label} copied` : ""}
      </span>
    </div>
  );
}
