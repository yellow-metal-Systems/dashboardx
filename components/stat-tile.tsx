import { Card, CardContent } from "@/components/ui/card";

/** A headline number on a card. Overview and the Leads page share it. */
export function StatTile({
  label,
  value,
  suffix,
  note,
}: {
  label: string;
  value: number;
  suffix?: string;
  note?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4 md:p-6">
        <p className="text-xs text-on-surface-variant">{label}</p>
        <p className="text-heading-xl tabular-nums text-on-surface">
          {value}
          {suffix}
        </p>
        {note && <p className="text-xs text-on-surface-variant">{note}</p>}
      </CardContent>
    </Card>
  );
}
