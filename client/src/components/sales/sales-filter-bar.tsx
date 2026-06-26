"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname as useNextPathname, useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function SalesFilterBar() {
  const router = useRouter();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("SalesPage");
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";

  const currentStatus = searchParams.get("status") ?? "all";
  const currentPayment = searchParams.get("payment_method") ?? "all";
  const currentSort = searchParams.get("sort") ?? "-created_at";
  const currentMemberId = searchParams.get("member_id") ?? "";
  const currentSellerId = searchParams.get("seller_id") ?? "";
  const [memberId, setMemberId] = React.useState(currentMemberId);
  const [sellerId, setSellerId] = React.useState(currentSellerId);
  const deferredMemberId = React.useDeferredValue(memberId);
  const deferredSellerId = React.useDeferredValue(sellerId);

  const updateQueryParam = React.useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");

    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (deferredMemberId !== currentMemberId) {
        updateQueryParam("member_id", deferredMemberId.trim());
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [currentMemberId, deferredMemberId, updateQueryParam]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (deferredSellerId !== currentSellerId) {
        updateQueryParam("seller_id", deferredSellerId.trim());
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [currentSellerId, deferredSellerId, updateQueryParam]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid max-w-xl flex-1 gap-3 sm:grid-cols-2">
        <SearchInput
          value={memberId}
          placeholder={t("memberFilterPlaceholder")}
          isArabic={isArabic}
          onChange={setMemberId}
        />
        <SearchInput
          value={sellerId}
          placeholder={t("sellerFilterPlaceholder")}
          isArabic={isArabic}
          onChange={setSellerId}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <SelectFilter
          label={t("statusFilterLabel")}
          value={currentStatus}
          isArabic={isArabic}
          onValueChange={(value) => updateQueryParam("status", value ?? "all")}
          items={[
            ["all", t("filterAll")],
            ["completed", t("statusCompleted")],
            ["voided", t("statusVoided")],
          ]}
        />
        <SelectFilter
          label={t("paymentFilterLabel")}
          value={currentPayment}
          isArabic={isArabic}
          onValueChange={(value) => updateQueryParam("payment_method", value ?? "all")}
          items={[
            ["all", t("filterAll")],
            ["cash", t("paymentCash")],
            ["card", t("paymentCard")],
            ["bank_transfer", t("paymentBank")],
          ]}
        />
        <SelectFilter
          label={t("sortLabel")}
          value={currentSort}
          isArabic={isArabic}
          onValueChange={(value) => updateQueryParam("sort", value ?? "-created_at")}
          items={[
            ["-created_at", t("sortNewest")],
            ["created_at", t("sortOldest")],
            ["-total", t("sortTotalHigh")],
            ["total", t("sortTotalLow")],
          ]}
        />
      </div>
    </div>
  );
}

function SearchInput({
  value,
  placeholder,
  isArabic,
  onChange,
}: {
  value: string;
  placeholder: string;
  isArabic: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <div className={cn("pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground", isArabic ? "right-3" : "left-3")}>
        <Search className="size-4" />
      </div>
      <Input
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn("h-9 bg-card shadow-sm", isArabic ? "pr-9 text-right" : "pl-9 text-left")}
      />
    </div>
  );
}

function SelectFilter({
  label,
  value,
  isArabic,
  onValueChange,
  items,
}: {
  label: string;
  value: string;
  isArabic: boolean;
  onValueChange: (value: string | null) => void;
  items: [string, string][];
}) {
  return (
    <div className="space-y-1">
      <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 min-w-36 bg-card text-xs font-semibold shadow-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
          {items.map(([itemValue, itemLabel]) => (
            <SelectItem key={itemValue} value={itemValue}>
              {itemLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
