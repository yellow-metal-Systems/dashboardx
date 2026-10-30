import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MessagePage } from "@/components/message-page";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col bg-background">
      <MessagePage
        title="Page not found"
        actions={
          <Button asChild variant="dark">
            <Link href="/dashboard">Go to Leads</Link>
          </Button>
        }
      >
        This address doesn&apos;t lead anywhere. Check the link, or start again from Leads.
      </MessagePage>
    </main>
  );
}
