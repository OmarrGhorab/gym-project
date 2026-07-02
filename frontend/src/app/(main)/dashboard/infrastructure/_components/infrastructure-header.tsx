"use client";

import { Activity, AlertTriangle, CheckCircle2, Gauge, RefreshCw, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import type { SystemHealthData } from "./data";

export function InfrastructureHeader({ data }: { data: SystemHealthData }) {
  const t = useTranslations("Dashboard.infrastructure");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-medium text-2xl leading-tight tracking-tight sm:text-3xl sm:leading-none">
            {t("title")}
          </h1>
          <p className="max-w-3xl text-muted-foreground text-sm">{t("description")}</p>
        </div>

        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <span className="whitespace-nowrap text-muted-foreground text-sm">
            {t("updated", { time: formatDateTime(data.generated_at, locale) })}
          </span>
          <Button
            render={<a href="/dashboard/infrastructure" aria-label={t("refresh")} />}
            nativeButton={false}
            variant="outline"
            size="icon-sm"
          >
            <RefreshCw />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Gauge}
          label={t("setupScore")}
          value={`${data.summary.setup_score}%`}
          detail={t("modulesReady", { ready: data.summary.ready_count, total: data.summary.modules_count })}
          progress={data.summary.setup_score}
        />
        <SummaryCard
          icon={CheckCircle2}
          label={t("readyModules")}
          value={data.summary.ready_count.toString()}
          detail={t("cleanChecks")}
          tone="ready"
        />
        <SummaryCard
          icon={AlertTriangle}
          label={t("warnings")}
          value={(data.summary.warning_count + data.summary.critical_count).toString()}
          detail={t("criticalGaps", { count: data.summary.critical_count })}
          tone={data.summary.critical_count > 0 ? "critical" : "warning"}
        />
        <SummaryCard
          icon={Activity}
          label={t("auditEvents")}
          value={data.summary.audit_events_count.toString()}
          detail={t("lastSevenDays")}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="h-auto gap-1 rounded-sm px-1.5 py-0.5">
          <ShieldCheck />
          {t("accessChecked")}
        </Badge>
        <Badge variant="outline" className="h-auto gap-1 rounded-sm px-1.5 py-0.5">
          <Activity />
          {t("auditConnected")}
        </Badge>
        <Badge variant="outline" className="h-auto gap-1 rounded-sm px-1.5 py-0.5">
          <span className="size-2 rounded-full bg-emerald-500" />
          {t("liveData")}
        </Badge>
      </div>
    </div>
  );
}

function SummaryCard({
  detail,
  icon: Icon,
  label,
  progress,
  tone = "neutral",
  value,
}: {
  detail: string;
  icon: typeof Gauge;
  label: string;
  progress?: number;
  tone?: "neutral" | "ready" | "warning" | "critical";
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="font-medium text-2xl tabular-nums">{value}</p>
        </div>
        <span className={statusIconClass(tone)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-muted-foreground text-xs">{detail}</p>
      {typeof progress === "number" ? <Progress value={progress} className="mt-3 h-1.5" /> : null}
    </div>
  );
}

function statusIconClass(tone: "neutral" | "ready" | "warning" | "critical") {
  if (tone === "ready") {
    return "rounded-md bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400";
  }

  if (tone === "warning") {
    return "rounded-md bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400";
  }

  if (tone === "critical") {
    return "rounded-md bg-destructive/10 p-2 text-destructive";
  }

  return "rounded-md bg-muted p-2 text-muted-foreground";
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
