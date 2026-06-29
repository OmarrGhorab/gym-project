"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { AddMemberDialog } from "./member-action-dialogs";

type Option = {
  labelKey: "15" | "25" | "50" | "active" | "activePlan" | "all" | "inactive" | "missing" | "noPlan" | "ready";
  value: string;
};

const statusOptions: Option[] = [
  { labelKey: "all", value: "all" },
  { labelKey: "active", value: "active" },
  { labelKey: "inactive", value: "inactive" },
];

const planOptions: Option[] = [
  { labelKey: "all", value: "all" },
  { labelKey: "activePlan", value: "active" },
  { labelKey: "noPlan", value: "none" },
];

const qrOptions: Option[] = [
  { labelKey: "all", value: "all" },
  { labelKey: "ready", value: "ready" },
  { labelKey: "missing", value: "missing" },
];

const rowsOptions: Option[] = [
  { labelKey: "15", value: "15" },
  { labelKey: "25", value: "25" },
  { labelKey: "50", value: "50" },
];

export function MembersHeaderActions() {
  const t = useTranslations("Dashboard.membersPage");
  const router = useQueryRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.set({ page: null, q: query.trim() || null });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={submit} className="relative">
        <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="w-64 ps-8"
          placeholder={t("searchMembers")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setQuery("");
          router.replace({});
        }}
      >
        {t("reset")}
      </Button>
      <Button nativeButton={false} size="sm" variant="outline" render={<a href="/api/finance/export" />}>
        {t("export")}
      </Button>
      <AddMemberDialog />
    </div>
  );
}

export function MembersFilterBar({ total }: { total: number }) {
  const t = useTranslations("Dashboard.membersPage");
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale);
  const router = useQueryRouter();
  const searchParams = useSearchParams();

  return (
    <div className="flex flex-col gap-3 border-b p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label={t("status")}
            options={statusOptions}
            value={searchParams.get("status") ?? "all"}
            onValueChange={(value) => router.set({ page: null, status: value === "all" ? null : value })}
          />
          <FilterSelect
            label={t("plan")}
            options={planOptions}
            value={searchParams.get("plan") ?? "all"}
            onValueChange={(value) => router.set({ page: null, plan: value === "all" ? null : value })}
          />
          <FilterSelect
            label={t("qr")}
            options={qrOptions}
            value={searchParams.get("qr") ?? "all"}
            onValueChange={(value) => router.set({ page: null, qr: value === "all" ? null : value })}
          />
        </div>
        <FilterSelect
          label={t("rows")}
          options={rowsOptions}
          value={searchParams.get("per_page") ?? "15"}
          onValueChange={(value) => router.set({ page: null, per_page: value })}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-sm">
        <span>{t("showingMembers", { count: numberFormatter.format(total) })}</span>
      </div>
    </div>
  );
}

export function MembersPagination({
  currentPage,
  lastPage,
  perPage,
}: {
  currentPage: number;
  lastPage: number;
  perPage: string;
}) {
  const t = useTranslations("Dashboard.membersPage");
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale);
  const router = useQueryRouter();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>{t("rowsPerPage")}</span>
        <FilterSelect
          label={t("rows")}
          options={rowsOptions}
          value={perPage}
          onValueChange={(value) => router.set({ page: null, per_page: value })}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={currentPage <= 1}
          onClick={() => router.set({ page: String(Math.max(1, currentPage - 1)) })}
        >
          {t("previous")}
        </Button>
        <div className="text-muted-foreground">
          {t("pageOf", { page: numberFormatter.format(currentPage), total: numberFormatter.format(lastPage) })}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={currentPage >= lastPage}
          onClick={() => router.set({ page: String(Math.min(lastPage, currentPage + 1)) })}
        >
          {t("next")}
        </Button>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string;
  onValueChange: (value: string) => void;
  options: Option[];
  value: string;
}) {
  const t = useTranslations("Dashboard.membersPage");

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) {
          onValueChange(nextValue);
        }
      }}
    >
      <SelectTrigger className="w-fit">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {label}: {getOptionLabel(option, t)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function getOptionLabel(option: Option, t: ReturnType<typeof useTranslations>) {
  if (/^\d+$/.test(option.labelKey)) {
    return option.labelKey;
  }

  return t(option.labelKey);
}

function useQueryRouter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(params: URLSearchParams) {
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    router.refresh();
  }

  return {
    replace(next: Record<string, string | null>) {
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(next)) {
        if (value) {
          params.set(key, value);
        }
      }

      navigate(params);
    },
    set(next: Record<string, string | null>) {
      const params = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(next)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }

      navigate(params);
    },
  };
}
