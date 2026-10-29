import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  LOGGED: { label: "Saved (demo)", variant: "grey" },
  SENT: { label: "Sent", variant: "success" },
  FAILED: { label: "Failed", variant: "destructive" },
};

/** An email_messages status as a badge, for the Sent emails pages. */
export function EmailStatus({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, variant: "grey" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
