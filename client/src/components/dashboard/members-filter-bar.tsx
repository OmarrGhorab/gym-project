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
import type { Plan } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function MembersFilterBar({ plans = [] }: { plans?: Plan[] }) {
  const router = useRouter();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("MembersPage");
  const isArabic = locale === "ar";

  // next/navigation pathname includes the locale prefix; strip it so next-intl's router
  // doesn't prepend the locale a second time (e.g. /en/en/members).
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";

  // Get current filter values from URL
  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "all";
  const currentGender = searchParams.get("gender") ?? "all";
  const currentPlan = searchParams.get("plan_id") ?? "all";
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

  // Debounced search update
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (deferredSearchValue !== currentSearch) {
        updateQueryParam("search", deferredSearchValue);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [currentSearch, deferredSearchValue, pathname, router, searchParams, updateQueryParam]);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* Search Bar */}
      <div className="relative flex-1 max-w-md">
        <div className={`absolute inset-y-0 flex items-center pointer-events-none text-muted-foreground ${isArabic ? "right-3" : "left-3"}`}>
          <Search className="size-4" />
        </div>
        <Input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className={`h-9 w-full bg-card shadow-sm transition-all focus:ring-2 focus:ring-primary/50 ${isArabic ? "pr-9 pl-4 text-right" : "pl-9 pr-4 text-left"}`}
        />
      </div>

      {/* Filters Dropdowns */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Status Filter */}
        <div className="space-y-1">
          <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
            {t("filterStatusLabel")}
          </Label>
          <Select
            value={currentStatus}
            onValueChange={(val) => updateQueryParam("status", val ?? "all")}
          >
            <SelectTrigger className="h-9 min-w-[140px] bg-card shadow-sm text-xs font-semibold">
              <SelectValue placeholder={t("filterStatus")} />
            </SelectTrigger>
            <SelectContent
              align={isArabic ? "end" : "start"}
              side="bottom"
              sideOffset={4}
              alignItemWithTrigger={false}
            >
              <SelectItem value="all">{t("filterStatus")}</SelectItem>
              <SelectItem value="active">{t("filterStatusActive")}</SelectItem>
              <SelectItem value="inactive">{t("filterStatusInactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Subscription Plan Filter */}
        <div className="space-y-1">
          <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
            {t("filterPlanLabel")}
          </Label>
          <Select
            value={currentPlan}
            onValueChange={(val) => updateQueryParam("plan_id", val ?? "all")}
          >
            <SelectTrigger className="h-9 min-w-[160px] bg-card shadow-sm text-xs font-semibold">
              <SelectValue placeholder={t("filterPlan")} />
            </SelectTrigger>
            <SelectContent
              align={isArabic ? "end" : "start"}
              side="bottom"
              sideOffset={4}
              alignItemWithTrigger={false}
            >
              <SelectItem value="all">{t("filterPlan")}</SelectItem>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={String(plan.id)}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Gender Filter */}
        <div className="space-y-1">
          <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
            {t("filterGenderLabel")}
          </Label>
          <Select
            value={currentGender}
            onValueChange={(val) => updateQueryParam("gender", val ?? "all")}
          >
            <SelectTrigger className="h-9 min-w-[120px] bg-card shadow-sm text-xs font-semibold">
              <SelectValue placeholder={t("filterGender")} />
            </SelectTrigger>
            <SelectContent
              align={isArabic ? "end" : "start"}
              side="bottom"
              sideOffset={4}
              alignItemWithTrigger={false}
            >
              <SelectItem value="all">{t("filterGender")}</SelectItem>
              <SelectItem value="male">{t("filterGenderMale")}</SelectItem>
              <SelectItem value="female">{t("filterGenderFemale")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
