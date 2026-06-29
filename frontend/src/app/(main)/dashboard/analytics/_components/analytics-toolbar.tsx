"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

const refreshIntervalMs = 10 * 60 * 1000;

function formatGeneratedAt(value: string, locale: string, fallback: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AnalyticsToolbar({ generatedAt }: { generatedAt: string }) {
  const t = useTranslations("Dashboard.analytics");
  const locale = useLocale();
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
        {t("today")} · {t("refreshed", { time: formatGeneratedAt(generatedAt, locale, t("liveData")) })} ·{" "}
        {t("autoRefresh")}
      </div>
      <Button render={<a href="/dashboard/analytics" />} size="sm" variant="outline" nativeButton={false}>
        <RefreshCw />
        {t("refresh")}
      </Button>
    </div>
  );
}
