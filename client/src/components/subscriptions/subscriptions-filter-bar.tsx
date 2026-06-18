"use client";

import * as React from "react";
import { CalendarArrowDown, Search } from "lucide-react";
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

export function SubscriptionsFilterBar() {
  const router = useRouter();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("SubscriptionsPage");
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";

  const currentStatus = searchParams.get("status") ?? "all";
  const currentSort = searchParams.get("sort") ?? "end_date";
  const currentMemberId = searchParams.get("member_id") ?? "";
  const [memberId, setMemberId] = React.useState(currentMemberId);
  const deferredMemberId = React.useDeferredValue(memberId);

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
          inputMode="numeric"
          placeholder={t("memberFilterPlaceholder")}
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
          className={cn(
            "h-9 bg-card shadow-sm",
            isArabic ? "pr-9 text-right" : "pl-9 text-left"
          )}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
            {t("statusFilterLabel")}
          </Label>
          <Select
            value={currentStatus}
            onValueChange={(value) => updateQueryParam("status", value ?? "all")}
          >
            <SelectTrigger className="h-9 min-w-36 bg-card text-xs font-semibold shadow-sm">
              <SelectValue placeholder={t("filterAll")} />
            </SelectTrigger>
            <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
              <SelectItem value="all">{t("filterAll")}</SelectItem>
              <SelectItem value="active">{t("statusActive")}</SelectItem>
              <SelectItem value="frozen">{t("statusFrozen")}</SelectItem>
              <SelectItem value="expired">{t("statusExpired")}</SelectItem>
              <SelectItem value="stopped">{t("statusStopped")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
            {t("sortLabel")}
          </Label>
          <Select
            value={currentSort}
            onValueChange={(value) => updateQueryParam("sort", value ?? "end_date")}
          >
            <SelectTrigger className="h-9 min-w-40 bg-card text-xs font-semibold shadow-sm">
              <CalendarArrowDown className="size-3.5 text-muted-foreground" />
              <SelectValue placeholder={t("sortEndingSoon")} />
            </SelectTrigger>
            <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
              <SelectItem value="end_date">{t("sortEndingSoon")}</SelectItem>
              <SelectItem value="-created_at">{t("sortNewest")}</SelectItem>
              <SelectItem value="-start_date">{t("sortLatestStart")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
