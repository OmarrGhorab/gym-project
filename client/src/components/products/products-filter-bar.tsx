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

export function ProductsFilterBar() {
  const router = useRouter();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("ProductsPage");
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";

  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "all";
  const currentStock = searchParams.get("stock") ?? "all";
  const currentSort = searchParams.get("sort") ?? "-created_at";
  const [searchValue, setSearchValue] = React.useState(currentSearch);
  const deferredSearchValue = React.useDeferredValue(searchValue);

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
      if (deferredSearchValue !== currentSearch) {
        updateQueryParam("search", deferredSearchValue.trim());
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [currentSearch, deferredSearchValue, updateQueryParam]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="relative max-w-sm flex-1">
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground",
            isArabic ? "right-3" : "left-3"
          )}
        >
          <Search className="size-4" />
        </div>
        <Input
          placeholder={t("searchPlaceholder")}
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          className={cn(
            "h-9 bg-card shadow-sm",
            isArabic ? "pr-9 text-right" : "pl-9 text-left"
          )}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <SelectFilter
          label={t("statusFilterLabel")}
          value={currentStatus}
          onValueChange={(value) => updateQueryParam("status", value ?? "all")}
          isArabic={isArabic}
          items={[
            ["all", t("filterAll")],
            ["1", t("statusActive")],
            ["0", t("statusInactive")],
          ]}
        />
        <SelectFilter
          label={t("stockFilterLabel")}
          value={currentStock}
          onValueChange={(value) => updateQueryParam("stock", value ?? "all")}
          isArabic={isArabic}
          items={[
            ["all", t("filterAll")],
            ["low", t("stockLow")],
          ]}
        />
        <SelectFilter
          label={t("sortLabel")}
          value={currentSort}
          onValueChange={(value) => updateQueryParam("sort", value ?? "-created_at")}
          isArabic={isArabic}
          items={[
            ["-created_at", t("sortNewest")],
            ["name", t("sortName")],
            ["price", t("sortPriceLow")],
            ["-price", t("sortPriceHigh")],
            ["stock_quantity", t("sortStockLow")],
            ["-stock_quantity", t("sortStockHigh")],
          ]}
        />
      </div>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onValueChange,
  isArabic,
  items,
}: {
  label: string;
  value: string;
  onValueChange: (value: string | null) => void;
  isArabic: boolean;
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
