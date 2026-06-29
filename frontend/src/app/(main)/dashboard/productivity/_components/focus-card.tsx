"use client";

import { BellRing } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { OperationsSummaryData } from "./data";

export function FocusCard({ summary }: { summary: OperationsSummaryData["summary"] }) {
  const t = useTranslations("Dashboard.productivity");

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>{t("focus")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-2xl tracking-tight">{summary.focus_title}</div>
              <div className="line-clamp-2 text-muted-foreground text-sm">{summary.focus_description}</div>
            </div>
            <Button render={<a href="/dashboard/analytics" />} nativeButton={false} className="min-w-24">
              {t("open")}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <BellRing className="size-3" />
            <span>{t("itemsNeedReview", { count: summary.pending_review_count })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
