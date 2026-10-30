"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { MessagePage } from "@/components/message-page";

// Outside the dashboard (sign-in, join links). Dashboard pages have their own.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col bg-background">
      <MessagePage
        title="This page didn't load"
        actions={
          <Button variant="dark" onClick={reset}>
            Try again
          </Button>
        }
      >
        Something went wrong on our side. Please try again in a moment.
        {error.digest && <span className="mt-2 block text-xs">Reference: {error.digest}</span>}
      </MessagePage>
    </main>
  );
}
