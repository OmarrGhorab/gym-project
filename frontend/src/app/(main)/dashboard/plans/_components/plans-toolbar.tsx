"use client";

import { useCallback, useRef, useState, useTransition } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PlansToolbar() {
  const t = useTranslations("Dashboard.plans");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(searchParams.get("search") ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "" || value === "all") {
          nextParams.delete(key);
        } else {
          nextParams.set(key, value);
        }
      }

      startTransition(() => {
        router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="plans-search"
          className="pl-9"
          placeholder={t("searchPlaceholder")}
          value={searchValue}
          onChange={(event) => {
            const value = event.target.value;
            setSearchValue(value);

            if (timerRef.current) {
              clearTimeout(timerRef.current);
            }

            timerRef.current = setTimeout(() => pushParams({ search: value || null }), 300);
          }}
        />
      </div>
      <Select value={searchParams.get("type") ?? "all"} onValueChange={(value) => pushParams({ type: value })}>
        <SelectTrigger id="plans-type-filter" className="w-[160px]">
          <SelectValue placeholder={t("filterType")} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">{t("allTypes")}</SelectItem>
            <SelectItem value="membership">{t("planTypes.membership")}</SelectItem>
            <SelectItem value="fitness_studio">Fitness Studio</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select value={searchParams.get("status") ?? "all"} onValueChange={(value) => pushParams({ status: value })}>
        <SelectTrigger id="plans-status-filter" className="w-[160px]">
          <SelectValue placeholder={t("filterStatus")} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="active">{t("active")}</SelectItem>
            <SelectItem value="inactive">{t("inactive")}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
