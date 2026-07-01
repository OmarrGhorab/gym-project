"use client";

import { useEffect } from "react";

import { format, parseISO } from "date-fns";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { LiveAttendanceFilters } from "./data";

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

export function AnalyticsToolbar({ filters, generatedAt }: { filters: LiveAttendanceFilters; generatedAt: string }) {
  const t = useTranslations("Dashboard.analytics");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDate = parseDateString(filters.date);

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [router]);

  function updateFilter(key: keyof LiveAttendanceFilters, value: string | number) {
    const params = new URLSearchParams(searchParams);
    params.set(key, String(value));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="rounded-md border bg-card px-3 py-2 text-muted-foreground text-sm">
        {t("refreshed", { time: formatGeneratedAt(generatedAt, locale, t("liveData")) })} ·{" "}
        {t("autoRefresh")}
      </div>

      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" size="sm" className="min-w-36 justify-between font-normal" />
          }
        >
          {selectedDate
            ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(selectedDate)
            : t("today")}
          <CalendarIcon data-icon="inline-end" className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto overflow-hidden p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            captionLayout="dropdown"
            onSelect={(date) => {
              if (date) {
                updateFilter("date", format(date, "yyyy-MM-dd"));
              }
            }}
          />
        </PopoverContent>
      </Popover>

      <Select value={filters.hours.toString()} onValueChange={(value) => updateFilter("hours", value ?? "24")}>
        <SelectTrigger size="sm" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="6">{t("lastHours", { count: 6 })}</SelectItem>
            <SelectItem value="12">{t("lastHours", { count: 12 })}</SelectItem>
            <SelectItem value="24">{t("lastHours", { count: 24 })}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select value={filters.audience} onValueChange={(value) => updateFilter("audience", value ?? "all")}>
        <SelectTrigger size="sm" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">{t("allPeople")}</SelectItem>
            <SelectItem value="members">{t("members")}</SelectItem>
            <SelectItem value="staff">{t("staff")}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select value={filters.metric} onValueChange={(value) => updateFilter("metric", value ?? "occupancy")}>
        <SelectTrigger size="sm" className="w-34">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="occupancy">{t("metricOccupancy")}</SelectItem>
            <SelectItem value="entries">{t("metricEntries")}</SelectItem>
            <SelectItem value="alerts">{t("metricAlerts")}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Button render={<a href="/dashboard/analytics" />} size="sm" variant="outline" nativeButton={false}>
        <RefreshCw />
        {t("refresh")}
      </Button>
    </div>
  );
}

function parseDateString(value: string) {
  if (!value) {
    return undefined;
  }

  const date = parseISO(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}
