"use client";

import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isNetworkLike = /fetch|network|failed|ECONN|timeout|unavailable/i.test(error.message);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="flex max-w-lg flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center text-card-foreground">
        <div className="grid size-14 place-items-center rounded-2xl border bg-muted text-muted-foreground">
          {isNetworkLike ? <WifiOff className="size-6" /> : <AlertTriangle className="size-6" />}
        </div>
        <div className="space-y-2">
          <h1 className="font-semibold text-2xl">{isNetworkLike ? "Connection problem." : "Something went wrong."}</h1>
          <p className="text-muted-foreground">
            {isNetworkLike
              ? "The dashboard could not reach the API. Check the backend or your connection, then try again."
              : "The dashboard hit an unexpected error. Try again, and if it keeps happening check the server logs."}
          </p>
        </div>
        <Button type="button" onClick={reset}>
          <RefreshCw data-icon="inline-start" />
          Try again
        </Button>
      </div>
    </div>
  );
}
