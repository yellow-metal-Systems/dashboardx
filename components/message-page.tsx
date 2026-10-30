import { Card, CardContent } from "@/components/ui/card";

/** A centred card for a page that has only something to say: not found, or an error.
 *  Not a <main>: inside the dashboard, SidebarInset already is one. */
export function MessagePage({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col gap-3 p-6 md:p-9">
          <h1 className="text-heading-md text-on-surface">{title}</h1>
          <div className="text-sm text-on-surface-variant">{children}</div>
          <div className="mt-3 flex flex-wrap gap-3">{actions}</div>
        </CardContent>
      </Card>
    </div>
  );
}
