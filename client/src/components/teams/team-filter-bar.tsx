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

export function TeamFilterBar({ namespace = "TeamsPage" }: { namespace?: "TeamsPage" | "TrainersPage" }) {
  const router = useRouter();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations(namespace);
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";

  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "all";
  const currentRole = searchParams.get("role") ?? (namespace === "TrainersPage" ? "captain" : "all");
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
        <div className="space-y-1">
          <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
            {t("roleFilterLabel")}
          </Label>
          <Select
            value={currentRole}
            onValueChange={(value) => updateQueryParam("role", value ?? "all")}
          >
            <SelectTrigger className="h-9 min-w-36 bg-card text-xs font-semibold shadow-sm">
              <SelectValue placeholder={t("filterAll")} />
            </SelectTrigger>
            <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
              <SelectItem value="all">{t("filterAll")}</SelectItem>
              <SelectItem value="captain">{t("roleCaptain")}</SelectItem>
              <SelectItem value="manager">{t("roleManager")}</SelectItem>
              <SelectItem value="employee">{t("roleEmployee")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
            {t("statusFilterLabel")}
          </Label>
          <Select
            value={currentStatus}
            onValueChange={(value) => updateQueryParam("status", value ?? "all")}
          >
            <SelectTrigger className="h-9 min-w-32 bg-card text-xs font-semibold shadow-sm">
              <SelectValue placeholder={t("filterAll")} />
            </SelectTrigger>
            <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
              <SelectItem value="all">{t("filterAll")}</SelectItem>
              <SelectItem value="active">{t("statusActive")}</SelectItem>
              <SelectItem value="inactive">{t("statusInactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
