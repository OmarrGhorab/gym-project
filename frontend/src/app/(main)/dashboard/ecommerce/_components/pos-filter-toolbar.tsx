"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { PosPaymentMethodFilter, PosPeriodFilter } from "./data";

const periods: Array<{ label: string; value: PosPeriodFilter }> = [
  { label: "This Month", value: "this-month" },
  { label: "Last Month", value: "last-month" },
  { label: "Last 30 Days", value: "last-30-days" },
  { label: "Year to Date", value: "year-to-date" },
];

const paymentMethods: Array<{ label: string; value: PosPaymentMethodFilter }> = [
  { label: "POS", value: "pos" },
  { label: "Cash Sales", value: "cash" },
  { label: "Card Sales", value: "card" },
  { label: "Bank Transfer", value: "bank_transfer" },
];

export function PosFilterToolbar({
  paymentMethod,
  period,
}: {
  paymentMethod: PosPaymentMethodFilter;
  period: PosPeriodFilter;
}) {
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
          <SelectValue placeholder="This Month" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {periods.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
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
          <SelectValue placeholder="POS" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {paymentMethods.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
