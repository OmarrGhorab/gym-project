"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname as useNextPathname, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ExpensesPagination({
  nextCursor,
  prevCursor,
}: {
  nextCursor?: string | null;
  prevCursor?: string | null;
}) {
  const locale = useLocale();
  const t = useTranslations("ExpensesPage");
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";

  function buildHref(cursor: string | null | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (cursor) {
      params.set("cursor", cursor);
    } else {
      params.delete("cursor");
    }
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between border-t bg-muted/20 px-4 py-3 sm:px-6",
        isArabic && "flex-row-reverse"
      )}
    >
      <p className="text-xs font-semibold text-muted-foreground">
        {t("cursorPaginationHint")}
      </p>
      <div className={cn("flex items-center gap-2", isArabic && "flex-row-reverse")}>
        <Button asChild variant="outline" size="sm" className={cn(!prevCursor && "pointer-events-none opacity-50")}>
          <Link href={buildHref(prevCursor)} locale={locale}>
            <ChevronLeft className="size-3.5" />
            {t("previous")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className={cn(!nextCursor && "pointer-events-none opacity-50")}>
          <Link href={buildHref(nextCursor)} locale={locale}>
            {t("next")}
            <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
