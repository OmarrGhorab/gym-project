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

type SubscriptionsPaginationProps = {
  currentPage: number;
  lastPage: number;
};

export function SubscriptionsPagination({
  currentPage,
  lastPage,
}: SubscriptionsPaginationProps) {
  const locale = useLocale();
  const rawPathname = useNextPathname();
  const searchParams = useSearchParams();
  const isArabic = locale === "ar";
  const pathname = rawPathname.replace(new RegExp(`^/${locale}`), "") || "/";

  function buildHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    return `${pathname}?${params.toString()}`;
  }

  const pages = getPaginationItems(currentPage, Math.max(1, lastPage));

  return (
    <div
      className={cn(
        "flex items-center justify-between border-t bg-muted/20 px-4 py-3 sm:px-6",
        isArabic && "flex-row-reverse"
      )}
    >
      <p className="text-xs font-semibold text-muted-foreground">
        {isArabic ? (
          <>
            صفحة <span className="font-bold text-foreground tabular-nums">{currentPage}</span> من{" "}
            <span className="font-bold text-foreground tabular-nums">{Math.max(1, lastPage)}</span>
          </>
        ) : (
          <>
            Page <span className="font-bold text-foreground tabular-nums">{currentPage}</span> of{" "}
            <span className="font-bold text-foreground tabular-nums">{Math.max(1, lastPage)}</span>
          </>
        )}
      </p>

      <Pagination>
        <PaginationContent className={cn(isArabic && "flex-row-reverse")}>
          <PaginationItem>
            <PaginationPrevious
              href={buildHref(Math.max(1, currentPage - 1))}
              className={cn(currentPage <= 1 && "pointer-events-none opacity-50")}
            />
          </PaginationItem>
          {pages.map((page, index) =>
            page === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink href={buildHref(page)} isActive={page === currentPage}>
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              href={buildHref(Math.min(Math.max(1, lastPage), currentPage + 1))}
              className={cn(currentPage >= lastPage && "pointer-events-none opacity-50")}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function getPaginationItems(currentPage: number, lastPage: number): (number | "ellipsis")[] {
  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, index) => index + 1);
  }

  const pages: (number | "ellipsis")[] = [1];
  if (currentPage > 3) pages.push("ellipsis");

  for (
    let page = Math.max(2, currentPage - 1);
    page <= Math.min(lastPage - 1, currentPage + 1);
    page++
  ) {
    pages.push(page);
  }

  if (currentPage < lastPage - 2) pages.push("ellipsis");
  pages.push(lastPage);

  return pages;
}
