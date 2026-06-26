"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname as useNextPathname, useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { DatePicker } from "@/components/ui/date-picker";
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

export function AttendanceFilterBar() {
  const router = useRouter();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("AttendancePage");
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";
  const employeeId = searchParams.get("employee_id") ?? "";
  const status = searchParams.get("status") ?? "all";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const sort = searchParams.get("sort") ?? "-date";

  function updateQueryParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
      <div className="space-y-1">
        <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
          {t("employeeFilterLabel")}
        </Label>
        <Input
          value={employeeId}
          inputMode="numeric"
          placeholder={t("employeePlaceholder")}
          onChange={(event) => updateQueryParam("employee_id", event.target.value)}
          className={cn("h-9 bg-card shadow-sm", isArabic && "text-right")}
        />
      </div>

      <DateFilter
        label={t("fromLabel")}
        value={from}
        locale={locale}
        isArabic={isArabic}
        placeholder={t("fromPlaceholder")}
        onChange={(value) => updateQueryParam("from", value ?? "")}
      />
      <DateFilter
        label={t("toLabel")}
        value={to}
        locale={locale}
        isArabic={isArabic}
        placeholder={t("toPlaceholder")}
        onChange={(value) => updateQueryParam("to", value ?? "")}
      />

      <div className="space-y-1">
        <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
          {t("statusFilterLabel")}
        </Label>
        <Select value={status} onValueChange={(value) => updateQueryParam("status", value ?? "all")}>
          <SelectTrigger className="h-9 w-full bg-card text-xs font-semibold shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
            <SelectItem value="all">{t("filterAll")}</SelectItem>
            <SelectItem value="present">{t("statusPresent")}</SelectItem>
            <SelectItem value="late">{t("statusLate")}</SelectItem>
            <SelectItem value="absent">{t("statusAbsent")}</SelectItem>
            <SelectItem value="excused">{t("statusExcused")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
          {t("sortLabel")}
        </Label>
        <Select value={sort} onValueChange={(value) => updateQueryParam("sort", value ?? "-date")}>
          <SelectTrigger className="h-9 min-w-40 bg-card text-xs font-semibold shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
            <SelectItem value="-date">{t("sortNewest")}</SelectItem>
            <SelectItem value="date">{t("sortOldest")}</SelectItem>
            <SelectItem value="check_in">{t("sortCheckIn")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function DateFilter({
  label,
  value,
  locale,
  isArabic,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  locale: string;
  isArabic: boolean;
  placeholder: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
        {label}
      </Label>
      <DatePicker
        value={value || undefined}
        onChange={onChange}
        placeholder={placeholder}
        locale={locale}
        className={cn("h-9", isArabic && "text-right")}
      />
    </div>
  );
}
