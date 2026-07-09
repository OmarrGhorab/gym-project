"use client";

import * as React from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field";
import { FormDatePicker } from "@/components/ui/form-controls";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FinanceFiltersProps = {
  defaults: {
    from: string;
    to: string;
  };
};

export function FinanceFilters({ defaults }: FinanceFiltersProps) {
  const t = useTranslations("Dashboard.finance");
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFrom = searchParams.get("from") ?? defaults.from;
  const currentTo = searchParams.get("to") ?? defaults.to;

  const initialMode = React.useMemo(() => {
    if (currentFrom === currentTo) {
      return "daily" as const;
    }

    if (currentFrom.slice(0, 7) === currentTo.slice(0, 7) && currentFrom.endsWith("-01")) {
      return "monthly" as const;
    }

    return "range" as const;
  }, [currentFrom, currentTo]);

  const [mode, setMode] = React.useState<"daily" | "monthly" | "range">(initialMode);
  const [dailyDate, setDailyDate] = React.useState(currentTo);
  const [monthDate, setMonthDate] = React.useState(`${currentTo.slice(0, 7)}-01`);
  const [fromDate, setFromDate] = React.useState(currentFrom);
  const [toDate, setToDate] = React.useState(currentTo);

  React.useEffect(() => {
    setDailyDate(currentTo);
    setMonthDate(`${currentTo.slice(0, 7)}-01`);
    setFromDate(currentFrom);
    setToDate(currentTo);
    setMode(initialMode);
  }, [currentFrom, currentTo, initialMode]);

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString());

    if (mode === "daily") {
      params.set("from", dailyDate);
      params.set("to", dailyDate);
      params.set("group_by", "day");
    } else if (mode === "monthly") {
      const monthValue = monthDate.slice(0, 7);
      const [year, month] = monthValue.split("-").map(Number);
      const monthStart = `${monthValue}-01`;
      const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);

      params.set("from", monthStart);
      params.set("to", monthEnd);
      params.set("group_by", "day");
    } else {
      params.set("from", fromDate);
      params.set("to", toDate);
      params.set("group_by", "month");
    }

    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1">
        <FieldLabel className="text-xs">{t("filterPeriod")}</FieldLabel>
        <Select value={mode} onValueChange={(value) => setMode((value as "daily" | "monthly" | "range") ?? "range")}>
          <SelectTrigger className="w-32" size="sm">
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

      {mode === "daily" ? (
        <div className="grid gap-1">
          <FieldLabel className="text-xs">{t("exportDate")}</FieldLabel>
          <FormDatePicker name="finance_daily_date" value={dailyDate} onValueChange={setDailyDate} />
        </div>
      ) : null}

      {mode === "monthly" ? (
        <div className="grid gap-1">
          <FieldLabel className="text-xs">{t("exportMonth")}</FieldLabel>
          <FormDatePicker name="finance_month_date" value={monthDate} onValueChange={(value) => setMonthDate(value)} />
        </div>
      ) : null}

      {mode === "range" ? (
        <>
          <div className="grid gap-1">
            <FieldLabel className="text-xs">{t("exportFrom")}</FieldLabel>
            <FormDatePicker name="finance_from_date" value={fromDate} onValueChange={setFromDate} />
          </div>
          <div className="grid gap-1">
            <FieldLabel className="text-xs">{t("exportTo")}</FieldLabel>
            <FormDatePicker name="finance_to_date" value={toDate} onValueChange={setToDate} />
          </div>
        </>
      ) : null}

      <Button size="sm" variant="outline" onClick={applyFilters}>
        {t("applyFilter")}
      </Button>
    </div>
  );
}
