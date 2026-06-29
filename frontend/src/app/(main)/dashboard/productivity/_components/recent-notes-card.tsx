"use client";

import { Activity, FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { OperationsActivity } from "./data";

export function RecentNotesCard({ activity }: { activity: OperationsActivity[] }) {
  const t = useTranslations("Dashboard.productivity");
  const locale = useLocale();

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>{t("recentActivity")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {activity.length > 0 ? (
          activity.map((item) => (
            <div key={item.id} className="flex items-start gap-4">
              <Activity className="size-5 text-muted-foreground" />
              <div className="min-w-0">
                <div className="truncate font-medium text-sm leading-none">{item.title}</div>
                <div className="text-muted-foreground text-xs">
                  {item.description} · {formatDateTime(item.created_at, locale, t("noDate"))}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-start gap-4 text-muted-foreground">
            <FileText className="size-5" />
            <div className="text-sm">{t("noRecentActivity")}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDateTime(value: string | null, locale: string, fallback: string) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(date);
}
