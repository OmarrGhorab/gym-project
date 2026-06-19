"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname as useNextPathname, useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function ReportsFilterBar() {
  const router = useRouter();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("ReportsPage");
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const groupBy = searchParams.get("group_by") ?? "day";

  function updateQueryParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid gap-3 sm:grid-cols-3">
        <DateFilter label={t("fromLabel")} value={from} locale={locale} isArabic={isArabic} placeholder={t("fromPlaceholder")} onChange={(value) => updateQueryParam("from", value ?? "")} />
        <DateFilter label={t("toLabel")} value={to} locale={locale} isArabic={isArabic} placeholder={t("toPlaceholder")} onChange={(value) => updateQueryParam("to", value ?? "")} />
        <div className="space-y-1">
          <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>{t("groupByLabel")}</Label>
          <Select value={groupBy} onValueChange={(value) => updateQueryParam("group_by", value ?? "day")}>
            <SelectTrigger className="h-9 min-w-40 bg-card text-xs font-semibold shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
              <SelectItem value="day">{t("groupDay")}</SelectItem>
              <SelectItem value="month">{t("groupMonth")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
      <Label className={cn("text-xs font-semibold text-muted-foreground", isArabic && "block text-right")}>{label}</Label>
      <DatePicker value={value || undefined} onChange={onChange} placeholder={placeholder} locale={locale} className={cn("h-9", isArabic && "text-right")} />
    </div>
  );
}
