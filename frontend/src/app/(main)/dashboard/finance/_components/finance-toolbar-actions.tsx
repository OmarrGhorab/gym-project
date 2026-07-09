"use client";

import * as React from "react";

import { Download, FileSpreadsheet, FileText, RotateCw, ShieldCheck, UsersRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field";
import { FormDatePicker } from "@/components/ui/form-controls";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { RecordExpenseDialog } from "./record-expense-dialog";

export function FinanceToolbarActions({
  exportDefaults,
  updatedAt,
}: {
  exportDefaults: { from: string; groupBy: "day" | "month"; locale: string; to: string };
  updatedAt: string;
}) {
  const locale = useLocale();
  const t = useTranslations("Dashboard.finance");
  const [open, setOpen] = React.useState(false);
  const [periodType, setPeriodType] = React.useState<"daily" | "monthly" | "range">(
    exportDefaults.groupBy === "day" ? "daily" : "range",
  );
  const [dailyDate, setDailyDate] = React.useState(exportDefaults.to);
  const [monthValue, setMonthValue] = React.useState(exportDefaults.to.slice(0, 7));
  const [fromDate, setFromDate] = React.useState(exportDefaults.from);
  const [toDate, setToDate] = React.useState(exportDefaults.to);

  const buildExportUrl = React.useCallback(
    (format: "pdf" | "xlsx") => {
      const params = new URLSearchParams({
        format,
        locale: exportDefaults.locale,
      });

      if (periodType === "daily") {
        params.set("from", dailyDate);
        params.set("to", dailyDate);
        params.set("group_by", "day");
      } else if (periodType === "monthly") {
        const [year, month] = monthValue.split("-");
        const monthStart = `${year}-${month}-01`;
        const monthEnd = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);

        params.set("from", monthStart);
        params.set("to", monthEnd);
        params.set("group_by", "day");
      } else {
        params.set("from", fromDate);
        params.set("to", toDate);
        params.set("group_by", exportDefaults.groupBy);
      }

      return `/api/finance/export?${params.toString()}`;
    },
    [dailyDate, exportDefaults.groupBy, exportDefaults.locale, fromDate, monthValue, periodType, toDate],
  );
  let updatedAtLabel = locale === "ar" ? `آخر تحديث ${updatedAt}` : `Updated ${updatedAt}`;

  if (typeof t.has === "function" && t.has("updatedAt")) {
    updatedAtLabel = t("updatedAt", { time: updatedAt });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <RotateCw className="size-4" />
        <span>{updatedAtLabel}</span>
      </div>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Download data-icon="inline-start" />
        {t("actions.export")}
      </Button>
      <RecordExpenseDialog />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("exportTitle")}</DialogTitle>
            <DialogDescription>{t("exportDescription")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t("exportIncludesTitle")}</p>
                  <p className="text-muted-foreground text-xs">{t("exportIncludesDescription")}</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border bg-background/60 p-2">
                  <div className="flex items-center gap-2 font-medium text-xs">
                    <UsersRound className="size-3.5" />
                    {t("exportShiftSummaryTitle")}
                  </div>
                  <p className="mt-1 text-muted-foreground text-xs">{t("exportShiftSummaryDescription")}</p>
                </div>
                <div className="rounded-md border bg-background/60 p-2">
                  <div className="flex items-center gap-2 font-medium text-xs">
                    <FileSpreadsheet className="size-3.5" />
                    {t("exportShiftTransactionsTitle")}
                  </div>
                  <p className="mt-1 text-muted-foreground text-xs">{t("exportShiftTransactionsDescription")}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-1.5">
              <FieldLabel>{t("exportPeriodType")}</FieldLabel>
              <Select
                value={periodType}
                onValueChange={(value) => setPeriodType((value as "daily" | "monthly" | "range") ?? "range")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="daily">{t("exportPeriods.daily")}</SelectItem>
                    <SelectItem value="monthly">{t("exportPeriods.monthly")}</SelectItem>
                    <SelectItem value="range">{t("exportPeriods.range")}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {periodType === "daily" ? (
              <div className="grid gap-1.5">
                <FieldLabel htmlFor="finance-export-date">{t("exportDate")}</FieldLabel>
                <FormDatePicker
                  id="finance-export-date"
                  name="finance_export_date"
                  value={dailyDate}
                  onValueChange={(value) => setDailyDate(value)}
                />
              </div>
            ) : null}

            {periodType === "monthly" ? (
              <div className="grid gap-1.5">
                <FieldLabel htmlFor="finance-export-month">{t("exportMonth")}</FieldLabel>
                <FormDatePicker
                  id="finance-export-month"
                  name="finance_export_month"
                  value={`${monthValue}-01`}
                  onValueChange={(value) => setMonthValue(value.slice(0, 7))}
                />
              </div>
            ) : null}

            {periodType === "range" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <FieldLabel htmlFor="finance-export-from">{t("exportFrom")}</FieldLabel>
                  <FormDatePicker
                    id="finance-export-from"
                    name="finance_export_from"
                    value={fromDate}
                    onValueChange={(value) => setFromDate(value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <FieldLabel htmlFor="finance-export-to">{t("exportTo")}</FieldLabel>
                  <FormDatePicker
                    id="finance-export-to"
                    name="finance_export_to"
                    value={toDate}
                    onValueChange={(value) => setToDate(value)}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button nativeButton={false} render={<a href={buildExportUrl("xlsx")} />} onClick={() => setOpen(false)}>
              <FileSpreadsheet data-icon="inline-start" />
              {t("exportExcel")}
            </Button>
            <Button nativeButton={false} render={<a href={buildExportUrl("pdf")} />} onClick={() => setOpen(false)}>
              <FileText data-icon="inline-start" />
              {t("exportPdf")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
