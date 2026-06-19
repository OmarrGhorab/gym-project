"use client";

import * as React from "react";
import { Search } from "lucide-react";
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

const subjectOptions = [
  "member",
  "subscription",
  "sale",
  "payment",
  "payroll",
  "commission",
  "employee",
  "expense",
  "inventory_movement",
  "product",
  "plan",
  "subscription_freeze",
] as const;

export function AuditFilterBar() {
  const router = useRouter();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("AuditPage");
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";

  const currentSubject = searchParams.get("subject") ?? "all";
  const currentSort = searchParams.get("sort") ?? "-created_at";
  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";
  const currentCauser = searchParams.get("causer") ?? "";
  const [causer, setCauser] = React.useState(currentCauser);
  const deferredCauser = React.useDeferredValue(causer);

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
      if (deferredCauser !== currentCauser) {
        updateQueryParam("causer", deferredCauser.trim());
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [currentCauser, deferredCauser, updateQueryParam]);

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
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
          placeholder={t("causerPlaceholder")}
          value={causer}
          onChange={(event) => setCauser(event.target.value)}
          className={cn(
            "h-9 bg-card shadow-sm",
            isArabic ? "pr-9 text-right" : "pl-9 text-left"
          )}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <DateFilter
          label={t("fromLabel")}
          value={currentFrom}
          locale={locale}
          isArabic={isArabic}
          placeholder={t("fromPlaceholder")}
          onChange={(value) => updateQueryParam("from", value ?? "")}
        />
        <DateFilter
          label={t("toLabel")}
          value={currentTo}
          locale={locale}
          isArabic={isArabic}
          placeholder={t("toPlaceholder")}
          onChange={(value) => updateQueryParam("to", value ?? "")}
        />
        <SelectFilter
          label={t("subjectFilterLabel")}
          value={currentSubject}
          isArabic={isArabic}
          onValueChange={(value) => updateQueryParam("subject", value ?? "all")}
          items={[
            ["all", t("filterAll")],
            ...subjectOptions.map((subject) => [
              subject,
              t(`subjects.${subject}`),
            ] as [string, string]),
          ]}
        />
        <SelectFilter
          label={t("sortLabel")}
          value={currentSort}
          isArabic={isArabic}
          onValueChange={(value) => updateQueryParam("sort", value ?? "-created_at")}
          items={[
            ["-created_at", t("sortNewest")],
            ["created_at", t("sortOldest")],
          ]}
        />
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
    <div className="w-44 space-y-1">
      <Label
        className={cn(
          "text-xs font-semibold text-muted-foreground",
          isArabic && "block text-right"
        )}
      >
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

function SelectFilter({
  label,
  value,
  isArabic,
  onValueChange,
  items,
}: {
  label: string;
  value: string;
  isArabic: boolean;
  onValueChange: (value: string | null) => void;
  items: [string, string][];
}) {
  return (
    <div className="space-y-1">
      <Label
        className={cn(
          "text-xs font-semibold text-muted-foreground",
          isArabic && "block text-right"
        )}
      >
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 min-w-40 bg-card text-xs font-semibold shadow-sm">
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
