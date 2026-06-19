"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname as useNextPathname, useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function CommissionsFilterBar() {
  const router = useRouter();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("CommissionsPage");
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";
  const currentEmployeeId = searchParams.get("employee_id") ?? "";
  const currentMonth = searchParams.get("month") ?? "";
  const [employeeId, setEmployeeId] = React.useState(currentEmployeeId);
  const deferredEmployeeId = React.useDeferredValue(employeeId);

  const updateQueryParam = React.useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (!value) params.delete(key);
    else params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (deferredEmployeeId !== currentEmployeeId) {
        updateQueryParam("employee_id", deferredEmployeeId.trim());
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [currentEmployeeId, deferredEmployeeId, updateQueryParam]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
            {t("employeeFilterLabel")}
          </Label>
          <div className="relative">
            <Search className={cn("pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground", isArabic ? "right-3" : "left-3")} />
            <Input
              inputMode="numeric"
              value={employeeId}
              placeholder={t("employeePlaceholder")}
              onChange={(event) => setEmployeeId(event.target.value)}
              className={cn("h-9 bg-card shadow-sm", isArabic ? "pr-9 text-right" : "pl-9 text-left")}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
            {t("monthFilterLabel")}
          </Label>
          <Input
            type="month"
            value={currentMonth}
            onChange={(event) => updateQueryParam("month", event.target.value)}
            className={cn("h-9 bg-card shadow-sm", isArabic && "text-right")}
          />
        </div>
      </div>
    </div>
  );
}
