"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { endOfMonth, format, parseISO, startOfMonth, subDays, subMonths } from "date-fns";
import { CalendarIcon, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PlansToolbar() {
  const t = useTranslations("Dashboard.plans");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(searchParams.get("search") ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateRange: DateRange | undefined = {
    from: parseDate(searchParams.get("created_from")),
    to: parseDate(searchParams.get("created_to")),
  };

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || value === "all") {
          nextParams.delete(key);
        } else {
          nextParams.set(key, value);
        }
      }

      startTransition(() => {
        router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  function updateDateRange(range: DateRange | undefined) {
    pushParams({
      created_from: range?.from ? format(range.from, "yyyy-MM-dd") : null,
      created_to: range?.to ? format(range.to, "yyyy-MM-dd") : null,
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="plans-search"
          className="pl-9"
          placeholder={t("searchPlaceholder")}
          value={searchValue}
          onChange={(event) => {
            const value = event.target.value;
            setSearchValue(value);

            if (timerRef.current) {
              clearTimeout(timerRef.current);
            }

            timerRef.current = setTimeout(() => pushParams({ search: value || null }), 300);
          }}
        />
      </div>
      <Select value={searchParams.get("type") ?? "all"} onValueChange={(value) => pushParams({ type: value })}>
        <SelectTrigger id="plans-type-filter" className="w-[160px]">
          <SelectValue placeholder={t("filterType")} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">{t("allTypes")}</SelectItem>
            <SelectItem value="membership">{t("planTypes.membership")}</SelectItem>
            <SelectItem value="offer">{t("planTypes.offer")}</SelectItem>
            <SelectItem value="fitness_studio">{t("planTypes.fitnessStudio")}</SelectItem>
            <SelectItem value="extra_service">{t("planTypes.extraService")}</SelectItem>
            <SelectItem value="membership_extra_service">{t("planTypes.membershipExtraService")}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select value={searchParams.get("status") ?? "all"} onValueChange={(value) => pushParams({ status: value })}>
        <SelectTrigger id="plans-status-filter" className="w-[160px]">
          <SelectValue placeholder={t("filterStatus")} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="active">{t("active")}</SelectItem>
            <SelectItem value="inactive">{t("inactive")}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Popover>
        <PopoverTrigger
          render={<Button type="button" variant="outline" className="min-w-52 justify-between font-normal" />}
        >
          {formatRange(dateRange)}
          <CalendarIcon data-icon="inline-end" className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto overflow-hidden p-0">
          <Calendar
            mode="range"
            selected={dateRange}
            defaultMonth={dateRange.from}
            numberOfMonths={2}
            onSelect={updateDateRange}
          />
          <div className="flex flex-wrap gap-1 border-t p-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => updateDateRange({ from: new Date(), to: new Date() })}
            >
              Today
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => updateDateRange({ from: subDays(new Date(), 6), to: new Date() })}
            >
              Last 7 days
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                const month = subMonths(new Date(), 1);
                updateDateRange({ from: startOfMonth(month), to: endOfMonth(month) });
              }}
            >
              Last month
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatRange(range: DateRange | undefined) {
  if (!range?.from) return "Created date";
  if (!range.to) return format(range.from, "MMM d, yyyy");
  return `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`;
}
