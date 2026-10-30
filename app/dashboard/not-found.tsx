import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MessagePage } from "@/components/message-page";

// Shown inside the sidebar layout when a page calls notFound(), e.g. a lead,
// partner or email that doesn't exist (or was removed).
export default function DashboardNotFound() {
  return (
    <MessagePage
      title="Not found"
      actions={
        <Button asChild variant="dark">
          <Link href="/dashboard">Go to Leads</Link>
        </Button>
      }
    >
      There&apos;s nothing at this address. It may have been removed, or the link is wrong.
    </MessagePage>
  );
}
