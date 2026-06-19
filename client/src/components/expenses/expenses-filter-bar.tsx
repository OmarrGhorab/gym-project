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

export function ExpensesFilterBar() {
  const router = useRouter();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("ExpensesPage");
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";
  const currentCategory = searchParams.get("category") ?? "";
  const currentStart = searchParams.get("start_date") ?? "";
  const currentEnd = searchParams.get("end_date") ?? "";
  const currentSort = searchParams.get("sort") ?? "-date";

  function updateQueryParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cursor");

    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
            {t("categoryFilterLabel")}
          </Label>
          <Input
            value={currentCategory}
            placeholder={t("categoryPlaceholder")}
            onChange={(event) => updateQueryParam("category", event.target.value)}
            className={cn("h-9 bg-card shadow-sm", isArabic && "text-right")}
          />
        </div>
        <DateFilter
          label={t("startDateLabel")}
          value={currentStart}
          locale={locale}
          isArabic={isArabic}
          placeholder={t("startDatePlaceholder")}
          onChange={(value) => updateQueryParam("start_date", value ?? "")}
        />
        <DateFilter
          label={t("endDateLabel")}
          value={currentEnd}
          locale={locale}
          isArabic={isArabic}
          placeholder={t("endDatePlaceholder")}
          onChange={(value) => updateQueryParam("end_date", value ?? "")}
        />
      </div>

      <div className="space-y-1">
        <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>
          {t("sortLabel")}
        </Label>
        <Select value={currentSort} onValueChange={(value) => updateQueryParam("sort", value ?? "-date")}>
          <SelectTrigger className="h-9 min-w-40 bg-card text-xs font-semibold shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
            <SelectItem value="-date">{t("sortNewestDate")}</SelectItem>
            <SelectItem value="date">{t("sortOldestDate")}</SelectItem>
            <SelectItem value="-amount">{t("sortAmountHigh")}</SelectItem>
            <SelectItem value="amount">{t("sortAmountLow")}</SelectItem>
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
