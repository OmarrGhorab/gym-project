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

export function NotificationsFilterBar() {
  const router = useRouter();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("NotificationsPage");
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";
  const currentStatus = searchParams.get("status") ?? "all";

  function updateStatus(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");

    if (!value || value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }

    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className={cn(isArabic && "text-right")}>
        <p className="text-sm font-black text-foreground">{t("filtersTitle")}</p>
        <p className="text-xs font-semibold text-muted-foreground">
          {t("filtersDescription")}
        </p>
      </div>

      <div className="space-y-1">
        <Label
          className={cn(
            "text-xs font-semibold text-muted-foreground",
            isArabic && "block text-right"
          )}
        >
          {t("statusFilterLabel")}
        </Label>
        <Select value={currentStatus} onValueChange={updateStatus}>
          <SelectTrigger className="h-9 min-w-40 bg-card text-xs font-semibold shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
            <SelectItem value="all">{t("filterAll")}</SelectItem>
            <SelectItem value="unread">{t("statusUnread")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
