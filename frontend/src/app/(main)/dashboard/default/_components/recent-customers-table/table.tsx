"use client";
"use no memo";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { flexRender, getCoreRowModel, useReactTable, type VisibilityState } from "@tanstack/react-table";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  ListFilter,
  Search,
  UsersRound,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DashboardUser } from "@/lib/session";

import type { StaffOption } from "../../../members/_components/data";
import { MemberActionsMenu } from "../../../members/_components/member-action-dialogs";
import type { PlanRow } from "../../../plans/_components/data";
import type { MembersMeta, MembersQuery } from "../data";
import { createRecentCustomersColumns } from "./columns";
import type { RecentCustomerRow } from "./schema";

const statusValues = ["all", "active", "expired", "frozen", "stopped", "inactive", "none"] as const;
// `scheduled` is computed by the API rather than stored, so it can be shown on a
// row but not filtered on — the filter goes back to the database column.
const statusLabelValues = [...statusValues.filter((value) => value !== "all"), "scheduled"] as const;
const billingValues = ["all", "paid", "pending", "overdue", "trial"] as const;
const renewalAttentionValues = ["sessions_exhausted", "period_ended_sessions_left"] as const;
const sessionTimingStatusValues = [...renewalAttentionValues, "on_track", "not_applicable"] as const;
const joinedDateValues = ["all", "30", "90"] as const;
const sortValues = ["newest", "oldest", "name-asc", "name-desc"] as const;

const pageSizeItems = [10, 20, 30, 40, 50].map((pageSize) => ({
  value: `${pageSize}`,
  label: `${pageSize}`,
}));

export function RecentCustomersTable({
  data,
  meta,
  plans,
  query,
  staff,
  user,
}: {
  data: RecentCustomerRow[];
  meta: MembersMeta;
  plans: PlanRow[];
  query: MembersQuery;
  staff: StaffOption[];
  user: DashboardUser;
}) {
  const t = useTranslations("Dashboard.default.members");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rowSelection, setRowSelection] = React.useState({});
  const [searchQuery, setSearchQuery] = React.useState(query.search ?? "");
  const [columnVisibility] = React.useState<VisibilityState>({
    search: false,
    joinedWindow: false,
  });
  const statusFilter = query.status ?? "all";
  const renewalAttentionFilter = query.renewalAttention ?? "all";
  const billingFilter = query.billing ?? "all";
  const joinedDateFilter = query.joinedWindow ?? "all";
  const sortValue = query.sort ?? "newest";

  React.useEffect(() => {
    setSearchQuery(query.search ?? "");
  }, [query.search]);

  const updateMembersQuery = React.useCallback(
    (updates: Record<string, string | number | undefined>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString());

      if (resetPage) {
        params.set("members_page", "1");
      }

      for (const [key, value] of Object.entries(updates)) {
        const param = `members_${key}`;

        if (value === undefined || value === "" || value === "all") {
          params.delete(param);
        } else {
          params.set(param, String(value));
        }
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchQuery !== (query.search ?? "")) {
        updateMembersQuery({ search: searchQuery });
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [query.search, searchQuery, updateMembersQuery]);
  const statusOptions = React.useMemo(
    () =>
      statusValues.map((value) => ({
        value,
        label: value === "all" ? t("filters.all") : t(`filters.${value}`),
      })),
    [t],
  );
  const billingOptions = React.useMemo(
    () =>
      billingValues.map((value) => ({
        value,
        label: value === "all" ? t("filters.all") : t(`billingStatuses.${value}`),
      })),
    [t],
  );
  const renewalAttentionOptions = React.useMemo(
    () => [
      { value: "all", label: t("filters.allSessionTiming") },
      ...renewalAttentionValues.map((value) => ({ value, label: t(`filters.${value}`) })),
    ],
    [t],
  );
  const joinedDateOptions = React.useMemo(
    () =>
      joinedDateValues.map((value) => ({
        value,
        label: getJoinedDateLabel(value, t),
      })),
    [t],
  );
  const sortOptions = React.useMemo(
    () =>
      sortValues.map((value) => ({
        value,
        label: getSortLabel(value, t),
      })),
    [t],
  );
  const columns = React.useMemo(
    () =>
      createRecentCustomersColumns({
        labels: {
          actions: t("actions"),
          billing: t("billing"),
          billingStatuses: Object.fromEntries(
            billingValues.filter((value) => value !== "all").map((value) => [value, t(`billingStatuses.${value}`)]),
          ),
          contactMissing: t("contactMissing"),
          dateMissing: t("dateMissing"),
          endsAt: (values) => t("endsAt", values),
          startsAt: (values) => t("startsAt", values),
          joined: t("joined"),
          member: t("member"),
          noPlan: t("noPlan"),
          paidAmount: (values) => t("paidAmount", values),
          plan: t("plan"),
          selectAll: t("selectAll"),
          selectMember: (values) => t("selectMember", values),
          sessionTiming: t("sessionTiming"),
          sessionTimingDetails: {
            sessions_exhausted: (count) => t("sessionTimingDetails.sessions_exhausted", { count }),
            period_ended_sessions_left: (count) => t("sessionTimingDetails.period_ended_sessions_left", { count }),
          },
          sessionTimingStatuses: Object.fromEntries(
            sessionTimingStatusValues.map((value) => [value, t(`sessionTimingStatuses.${value}`)]),
          ),
          status: t("status"),
          statuses: Object.fromEntries(statusLabelValues.map((value) => [value, t(`statuses.${value}`)])),
        },
        locale,
        renderActions: (row) => (
          <MemberActionsMenu
            member={{
              id: Number(row.id),
              name: row.name,
              phone: row.phone,
              email: row.email || null,
              national_id: row.national_id ?? null,
              gender: row.gender ?? null,
              attendance_code: row.attendance_code ?? null,
              attendance_qr: row.attendance_qr ?? null,
              birth_date: row.birth_date ?? null,
              join_date: row.joined ?? null,
              expiry_date: row.planEndsAt ?? null,
              status: row.status ?? "inactive",
              notes: row.notes ?? null,
              has_photo: row.has_photo ?? false,
              total_paid: row.totalPaid,
              updated_at: row.updated_at ?? null,
              latest_subscription: row.latest_subscription ?? null,
            }}
            plans={plans}
            staff={staff}
            due={row.due ?? null}
            permissions={user.permissions}
            labels={{
              actionsFor: (values) => t("actionOpenMenu", values),
              addPayment: t("actionAddPayment"),
              addPaymentDescription: (values) => t("actionAddPaymentDescription", values),
              addSubscription: t("actionAddSubscription"),
              addSubscriptionExtra: t("addSubscriptionExtra"),
              addSubscriptionExtraDescription: t("addSubscriptionExtraDescription"),
              bankTransfer: t("paymentMethods.bankTransfer"),
              cancel: t("actionCancel"),
              card: t("paymentMethods.card"),
              cash: t("paymentMethods.cash"),
              changePlan: t("actionChangePlan"),
              changePlanDescription: (values) => t("actionChangePlanDescription", values),
              editMember: t("actionEditMember"),
              member: t("member"),
              noActivePlan: t("noPlan"),
              outstanding: t("outstanding"),
              paymentAmount: t("actionPaymentAmount"),
              paymentMethod: t("actionPaymentMethod"),
              pleaseTryAgain: t("actionFailed"),
              selectPaymentMethod: t("actionSelectPaymentMethod"),
              subscription: t("subscription"),
              uploadPhoto: t("actionUploadPhoto"),
              viewDetails: t("actionViewDetails"),
              working: t("actionWorking"),
            }}
          />
        ),
      }),
    [locale, plans, staff, t, user.permissions],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      columnVisibility,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    pageCount: meta.lastPage,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-7 rounded-[min(var(--radius-md),12px)] ps-8"
              placeholder={t("search")}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
              }}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <UsersRound />
              {t("status")}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-44" align="start">
              <DropdownMenuRadioGroup
                value={statusFilter}
                onValueChange={(value) => {
                  updateMembersQuery({ status: value });
                }}
              >
                {statusOptions.map((status) => (
                  <DropdownMenuRadioItem key={status.value} value={status.value} className="whitespace-nowrap">
                    {status.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <ListFilter />
              {t("sessionTiming")}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="start">
              <DropdownMenuRadioGroup
                value={renewalAttentionFilter}
                onValueChange={(value) => {
                  updateMembersQuery({ renewal: value });
                }}
              >
                {renewalAttentionOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value} className="whitespace-nowrap">
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <CalendarDays />
              {t("joinedDate")}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40" align="start">
              <DropdownMenuRadioGroup
                value={joinedDateFilter}
                onValueChange={(value) => {
                  updateMembersQuery({ joined: value });
                }}
              >
                {joinedDateOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <CreditCard />
              {t("billing")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={billingFilter}
                onValueChange={(value) => {
                  updateMembersQuery({ billing: value });
                }}
              >
                {billingOptions.map((billing) => (
                  <DropdownMenuRadioItem key={billing.value} value={billing.value}>
                    {billing.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <ArrowUpDown />
              {t("sort")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={sortValue}
                onValueChange={(value) => {
                  updateMembersQuery({ sort: value });
                }}
              >
                {sortOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader className="bg-muted/15">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan} className="h-11 p-3 font-medium">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="p-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                  {t("noMembers")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="hidden flex-1 text-muted-foreground text-sm lg:flex">
          {t("selected", {
            selected: table.getSelectedRowModel().rows.length,
            total: meta.total,
          })}
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="recent-customers-rows-per-page" className="font-medium text-sm">
              {t("rowsPerPage")}
            </Label>
            <Select
              value={`${meta.perPage}`}
              onValueChange={(value) => {
                if (value === null) {
                  return;
                }

                updateMembersQuery({ per_page: value });
              }}
              items={pageSizeItems}
            >
              <SelectTrigger size="sm" className="w-20" id="recent-customers-rows-per-page">
                <SelectValue placeholder={meta.perPage} />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {pageSizeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center font-medium text-sm">
            {t("pageOf", { page: meta.currentPage, total: meta.lastPage })}
          </div>
          <div className="ms-auto flex items-center gap-2 lg:ms-0">
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() => updateMembersQuery({ page: 1 }, false)}
              disabled={meta.currentPage <= 1}
            >
              <span className="sr-only">{t("goFirst")}</span>
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => updateMembersQuery({ page: meta.currentPage - 1 }, false)}
              disabled={meta.currentPage <= 1}
            >
              <span className="sr-only">{t("goPrevious")}</span>
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => updateMembersQuery({ page: meta.currentPage + 1 }, false)}
              disabled={meta.currentPage >= meta.lastPage}
            >
              <span className="sr-only">{t("goNext")}</span>
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() => updateMembersQuery({ page: meta.lastPage }, false)}
              disabled={meta.currentPage >= meta.lastPage}
            >
              <span className="sr-only">{t("goLast")}</span>
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getJoinedDateLabel(value: (typeof joinedDateValues)[number], t: ReturnType<typeof useTranslations>) {
  if (value === "all") {
    return t("filters.allTime");
  }

  if (value === "30") {
    return t("filters.last30");
  }

  return t("filters.last90");
}

function getSortLabel(value: (typeof sortValues)[number], t: ReturnType<typeof useTranslations>) {
  if (value === "newest") {
    return t("filters.newest");
  }

  if (value === "oldest") {
    return t("filters.oldest");
  }

  if (value === "name-asc") {
    return t("filters.nameAsc");
  }

  return t("filters.nameDesc");
}
