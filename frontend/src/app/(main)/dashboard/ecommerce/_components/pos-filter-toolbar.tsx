"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { PosPaymentMethodFilter, PosPeriodFilter } from "./data";

const periods: Array<{ labelKey: "last30Days" | "lastMonth" | "thisMonth" | "yearToDate"; value: PosPeriodFilter }> = [
  { labelKey: "thisMonth", value: "this-month" },
  { labelKey: "lastMonth", value: "last-month" },
  { labelKey: "last30Days", value: "last-30-days" },
  { labelKey: "yearToDate", value: "year-to-date" },
];

const paymentMethods: Array<{ labelKey: "bankTransfer" | "card" | "cash" | "pos"; value: PosPaymentMethodFilter }> = [
  { labelKey: "pos", value: "pos" },
  { labelKey: "cash", value: "cash" },
  { labelKey: "card", value: "card" },
  { labelKey: "bankTransfer", value: "bank_transfer" },
];

export function PosFilterToolbar({
  from,
  paymentMethod,
  period,
  to,
}: {
  from?: string;
  paymentMethod: PosPaymentMethodFilter;
  period: PosPeriodFilter;
  to?: string;
}) {
  const t = useTranslations("Dashboard.ecommerce");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedRange: DateRange | undefined = {
    from: parseDate(from),
    to: parseDate(to),
  };

  function updateFilter(key: "payment_method" | "period", value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.set(key, value);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  function updateDateRange(range: DateRange | undefined) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (range?.from) nextParams.set("from", format(range.from, "yyyy-MM-dd"));
    else nextParams.delete("from");

    if (range?.to) nextParams.set("to", format(range.to, "yyyy-MM-dd"));
    else nextParams.delete("to");

    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-end justify-end gap-2 lg:w-fit">
      <Popover>
        <PopoverTrigger
          render={<Button type="button" size="sm" variant="outline" className="min-w-56 justify-between font-normal" />}
        >
          {formatDateRange(selectedRange)}
          <CalendarIcon data-icon="inline-end" className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto overflow-hidden p-0">
          <Calendar
            mode="range"
            selected={selectedRange}
            defaultMonth={selectedRange.from}
            numberOfMonths={2}
            onSelect={updateDateRange}
          />
        </PopoverContent>
      </Popover>
      <Select
        value={period}
        onValueChange={(value) => {
          if (value) updateFilter("period", value);
        }}
      >
        <SelectTrigger className="w-36" id="ecommerce-period" size="sm">
          <SelectValue placeholder={t("filters.thisMonth")} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {periods.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(`filters.${option.labelKey}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        value={paymentMethod}
        onValueChange={(value) => {
          if (value) updateFilter("payment_method", value);
        }}
      >
        <SelectTrigger className="w-40" id="ecommerce-payment-method" size="sm">
          <SelectValue placeholder={t("filters.pos")} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {paymentMethods.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(`filters.${option.labelKey}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function parseDate(value?: string) {
  if (!value) return undefined;

  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateRange(range: DateRange | undefined) {
  if (!range?.from) return "Select dates";
  if (!range.to) return format(range.from, "MMM d, yyyy");

  return `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`;
}
