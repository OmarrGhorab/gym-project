"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

const refreshIntervalMs = 10 * 60 * 1000;

function formatGeneratedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Live data";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AnalyticsToolbar({ generatedAt }: { generatedAt: string }) {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <div className="flex items-center gap-2">
      <div className="rounded-md border bg-card px-3 py-2 text-muted-foreground text-sm">
        Today · refreshed {formatGeneratedAt(generatedAt)} · auto refresh every 10 min
      </div>
      <Button render={<a href="/dashboard/analytics" />} size="sm" variant="outline" nativeButton={false}>
        <RefreshCw />
        Refresh
      </Button>
    </div>
  );
}
