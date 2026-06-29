"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useTranslations } from "next-intl";

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
  paymentMethod,
  period,
}: {
  paymentMethod: PosPaymentMethodFilter;
  period: PosPeriodFilter;
}) {
  const t = useTranslations("Dashboard.ecommerce");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: "payment_method" | "period", value: string) {
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.set(key, value);
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-end justify-end gap-2 lg:w-fit">
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
