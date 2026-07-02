"use client";

import Link from "next/link";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
          <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center text-card-foreground">
            <div className="grid size-14 place-items-center rounded-2xl border bg-muted text-muted-foreground">
              <AlertTriangle className="size-6" />
            </div>
            <div className="space-y-2">
              <h1 className="font-semibold text-2xl">Something went wrong.</h1>
              <p className="text-muted-foreground">Refresh this page or go back to the dashboard.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={reset}>
                <RefreshCw data-icon="inline-start" />
                Try again
              </Button>
              <Button nativeButton={false} variant="outline" render={<Link href="/dashboard/default" />}>
                Dashboard
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
