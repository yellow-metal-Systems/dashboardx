"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MessagePage } from "@/components/message-page";

// Shown inside the sidebar layout when a dashboard page throws, so staff keep the
// navigation instead of landing on Next's unstyled default.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <MessagePage
      title="This page didn't load"
      actions={
        <>
          <Button variant="dark" onClick={reset}>
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Go to Leads</Link>
          </Button>
        </>
      }
    >
      Something went wrong on our side. Try again, or go back to Leads.
      {error.digest && <span className="mt-2 block text-xs">Reference: {error.digest}</span>}
    </MessagePage>
  );
}
