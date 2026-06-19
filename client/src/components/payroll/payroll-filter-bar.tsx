"use client";

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

export function PayrollFilterBar() {
  const router = useRouter();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("PayrollPage");
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";
  const currentMonth = searchParams.get("month") ?? "";
  const currentStatus = searchParams.get("status") ?? "all";
  const currentEmployee = searchParams.get("employee_id") ?? "";

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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="space-y-1">
          <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
            {t("employeeFilterLabel")}
          </Label>
          <Input
            inputMode="numeric"
            value={currentEmployee}
            placeholder={t("employeePlaceholder")}
            onChange={(event) => updateQueryParam("employee_id", event.target.value)}
            className={cn("h-9 bg-card shadow-sm", isArabic && "text-right")}
          />
        </div>
        <div className="space-y-1">
          <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
            {t("statusFilterLabel")}
          </Label>
          <Select value={currentStatus} onValueChange={(value) => updateQueryParam("status", value ?? "all")}>
            <SelectTrigger className="h-9 min-w-40 bg-card text-xs font-semibold shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
              <SelectItem value="all">{t("filterAll")}</SelectItem>
              <SelectItem value="pending">{t("statusPending")}</SelectItem>
              <SelectItem value="paid">{t("statusPaid")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
