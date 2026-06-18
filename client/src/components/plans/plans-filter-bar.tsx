"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname as useNextPathname, useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function PlansFilterBar() {
  const router = useRouter();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("PlansPage");
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";

  const currentType = searchParams.get("type") ?? "all";
  const currentStatus = searchParams.get("status") ?? "all";
  const currentSort = searchParams.get("sort") ?? "-created_at";

  function updateQueryParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");

    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
          {t("typeFilterLabel")}
        </Label>
        <Select value={currentType} onValueChange={(value) => updateQueryParam("type", value ?? "all")}>
          <SelectTrigger className="h-9 min-w-36 bg-card text-xs font-semibold shadow-sm">
            <SelectValue placeholder={t("filterAll")} />
          </SelectTrigger>
          <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
            <SelectItem value="all">{t("filterAll")}</SelectItem>
            <SelectItem value="membership">{t("typeMembership")}</SelectItem>
            <SelectItem value="offer">{t("typeOffer")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
          {t("statusFilterLabel")}
        </Label>
        <Select value={currentStatus} onValueChange={(value) => updateQueryParam("status", value ?? "all")}>
          <SelectTrigger className="h-9 min-w-32 bg-card text-xs font-semibold shadow-sm">
            <SelectValue placeholder={t("filterAll")} />
          </SelectTrigger>
          <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
            <SelectItem value="all">{t("filterAll")}</SelectItem>
            <SelectItem value="1">{t("statusActive")}</SelectItem>
            <SelectItem value="0">{t("statusInactive")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
          {t("sortLabel")}
        </Label>
        <Select value={currentSort} onValueChange={(value) => updateQueryParam("sort", value ?? "-created_at")}>
          <SelectTrigger className="h-9 min-w-40 bg-card text-xs font-semibold shadow-sm">
            <SelectValue placeholder={t("sortNewest")} />
          </SelectTrigger>
          <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
            <SelectItem value="-created_at">{t("sortNewest")}</SelectItem>
            <SelectItem value="name">{t("sortName")}</SelectItem>
            <SelectItem value="price">{t("sortPriceLow")}</SelectItem>
            <SelectItem value="-price">{t("sortPriceHigh")}</SelectItem>
            <SelectItem value="duration_days">{t("sortDuration")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
