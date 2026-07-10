"use client";

import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("Dashboard.shell");
  const isNetworkLike = /fetch|network|failed|ECONN|timeout|unavailable/i.test(error.message);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="flex max-w-lg flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center text-card-foreground">
        <div className="grid size-14 place-items-center rounded-2xl border bg-muted text-muted-foreground">
          {isNetworkLike ? <WifiOff className="size-6" /> : <AlertTriangle className="size-6" />}
        </div>
        <div className="space-y-2">
          <h1 className="font-semibold text-2xl">{isNetworkLike ? t("networkErrorTitle") : t("errorTitle")}</h1>
          <p className="text-muted-foreground">
            {isNetworkLike ? t("networkErrorDescription") : t("unexpectedErrorDescription")}
          </p>
        </div>
        <Button type="button" onClick={reset}>
          <RefreshCw data-icon="inline-start" />
          {t("tryAgain")}
        </Button>
      </div>
    </div>
  );
}
