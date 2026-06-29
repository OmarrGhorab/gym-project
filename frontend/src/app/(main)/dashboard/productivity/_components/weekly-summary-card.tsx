"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import type { OperationsSummaryData } from "./data";

export function WeeklySummaryCard({ week }: { week: OperationsSummaryData["week"] }) {
  const t = useTranslations("Dashboard.productivity");

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>{week.label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground">
          {t("weeklyActivity", {
            sales: week.sales,
            subscriptions: week.subscriptions_renewed,
            visits: week.member_visits,
          })}
        </p>
        <div className="flex flex-col gap-2">
          <div className="font-medium">{t("signalsCompleted", { completed: week.completed, total: week.total })}</div>
          <Progress value={week.progress} className="h-2" />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground text-xs">{t("payrollPaid")}</div>
            <div className="tabular-nums">{week.payroll_paid}</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground text-xs">{t("progress")}</div>
            <div className="tabular-nums">{week.progress}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
