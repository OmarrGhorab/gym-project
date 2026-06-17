"use client";

import { useLocale } from "next-intl";
import { usePathname as useNextPathname, useSearchParams } from "next/navigation";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

type MembersPaginationProps = {
  currentPage: number;
  lastPage: number;
  filters: {
    search?: string;
    status?: string;
    gender?: string;
    planId?: string;
  };
};

export function MembersPagination({
  currentPage,
  lastPage,
  filters,
}: MembersPaginationProps) {
  const locale = useLocale();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const isArabic = locale === "ar";

  // next/navigation pathname includes the locale prefix; strip it so next-intl's Link
  // doesn't prepend the locale a second time (e.g. /en/en/members).
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";

  function buildHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.gender) params.set("gender", filters.gender);
    if (filters.planId) params.set("plan_id", filters.planId);
    return `${pathname}?${params.toString()}`;
  }

  const pages = getPaginationItems(currentPage, lastPage);

  return (
    <div
      className={cn(
        "flex items-center justify-between border-t bg-muted/20 px-4 py-3 sm:px-6",
        isArabic ? "flex-row-reverse" : "flex-row"
      )}
    >
      <p className="text-xs font-semibold text-muted-foreground">
        {isArabic ? (
          <>
            صفحة{" "}
            <span className="font-bold text-foreground tabular-nums">
              {currentPage}
            </span>{" "}
            من{" "}
            <span className="font-bold text-foreground tabular-nums">
              {lastPage}
            </span>
          </>
        ) : (
          <>
            Page{" "}
            <span className="font-bold text-foreground tabular-nums">
              {currentPage}
            </span>{" "}
            of{" "}
            <span className="font-bold text-foreground tabular-nums">
              {lastPage}
            </span>
          </>
        )}
      </p>

      <Pagination>
        <PaginationContent className={cn(isArabic && "flex-row-reverse")}>
          <PaginationItem>
            <PaginationPrevious
              href={buildHref(currentPage - 1)}
              className={cn(
                currentPage <= 1 && "pointer-events-none opacity-50"
              )}
            />
          </PaginationItem>

          {pages.map((page, index) =>
            page === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  href={buildHref(page)}
                  isActive={page === currentPage}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          )}

          <PaginationItem>
            <PaginationNext
              href={buildHref(currentPage + 1)}
              className={cn(
                currentPage >= lastPage && "pointer-events-none opacity-50"
              )}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function getPaginationItems(currentPage: number, lastPage: number): (number | "ellipsis")[] {
  const pages: (number | "ellipsis")[] = [];

  if (lastPage <= 7) {
    for (let i = 1; i <= lastPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  pages.push(1);

  if (currentPage > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(lastPage - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < lastPage - 2) {
    pages.push("ellipsis");
  }

  pages.push(lastPage);

  return pages;
}
