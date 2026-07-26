"use client";

import { useMemo, useState, useTransition } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { format, parseISO } from "date-fns";
import { Banknote, BarChart3, Calendar, Download, FileText, Package, Search, UserRound, Users } from "lucide-react";
import { useLocale } from "next-intl";
import type { DateRange } from "react-day-picker";

import { DateRangePicker } from "@/components/date-range-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormSelect } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppNotificationButton } from "@/components/whatsapp-notification-button";

import { getEmployeeSubscriptionDetails, getProductSaleDetails } from "./employee-subscription-actions";

type ReportViewClientProps = {
  initialType: string;
  initialQuery: Record<string, string | undefined>;
  initialData: Record<string, unknown>;
};

export function ReportViewClient({ initialType, initialQuery, initialData }: ReportViewClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeTab = searchParams.get("type") ?? initialType;
  const fromDate = searchParams.get("from") ?? initialQuery.from ?? "";
  const toDate = searchParams.get("to") ?? initialQuery.to ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const categoryFilter = searchParams.get("category") ?? "";
  const searchFilter = searchParams.get("search") ?? "";
  const dateRange = useMemo<DateRange | undefined>(() => {
    const from = parseReportDate(fromDate);
    const to = parseReportDate(toDate);

    if (from || to) {
      return { from, to };
    }

    const today = new Date();
    return { from: today, to: today };
  }, [fromDate, toDate]);

  function updateParams(newParams: Record<string, string | null | undefined>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(newParams)) {
      if (value === null || value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleQuickDate(days: number | "this_month" | "last_month" | "ytd") {
    const today = new Date();
    let from = new Date();
    let to = new Date();

    if (typeof days === "number") {
      from.setDate(today.getDate() - days);
    } else if (days === "this_month") {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (days === "last_month") {
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (days === "ytd") {
      from = new Date(today.getFullYear(), 0, 1);
    }

    const fromStr = format(from, "yyyy-MM-dd");
    const toStr = format(to, "yyyy-MM-dd");

    updateParams({ from: fromStr, to: toStr });
  }

  function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Top Report Type Selection Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) =>
          updateParams({
            type: val,
            from: fromDate || (dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null),
            to: toDate || (dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : null),
          })
        }
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 gap-1 p-1 md:grid-cols-4 xl:grid-cols-7">
          <TabsTrigger value="overview" className="gap-2">
            <Calendar className="size-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-2">
            <Users className="size-4" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="captains" className="gap-2">
            <UserRound className="size-4" />
            Captains
          </TabsTrigger>
          <TabsTrigger value="classes_plans" className="gap-2">
            <Users className="size-4" />
            Classes & Plans
          </TabsTrigger>
          <TabsTrigger value="products_finance" className="gap-2">
            <Package className="size-4" />
            Products & POS
          </TabsTrigger>
          <TabsTrigger value="subs_shifts" className="gap-2">
            <BarChart3 className="size-4" />
            Subscriptions & Shifts
          </TabsTrigger>
          <TabsTrigger value="income_outcome" className="gap-2">
            <Banknote className="size-4" />
            Income vs Outcome
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Calendar & Filter Controls Bar */}
      <Card className="bg-muted/30">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="me-2 flex items-center gap-1.5 font-semibold text-muted-foreground text-xs">
                <Calendar className="size-4" /> Date Range:
              </span>
              <Button size="sm" variant="outline" onClick={() => handleQuickDate(7)}>
                Last 7 Days
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleQuickDate(30)}>
                Last 30 Days
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleQuickDate("this_month")}>
                This Month
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleQuickDate("last_month")}>
                Last Month
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleQuickDate("ytd")}>
                Year to Date
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <DateRangePicker
                value={dateRange}
                onChange={(range) =>
                  updateParams({
                    from: range?.from ? format(range.from, "yyyy-MM-dd") : null,
                    to: range?.to ? format(range.to, "yyyy-MM-dd") : null,
                  })
                }
              />
              {(fromDate || toDate || statusFilter || categoryFilter || searchFilter) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => updateParams({ from: null, to: null, status: null, category: null, search: null })}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Render Active Report View */}
      {activeTab === "overview" && <ReportsOverviewView data={initialData} onShortcut={handleQuickDate} />}

      {activeTab === "employees" && <EmployeesReportView data={initialData} from={fromDate} to={toDate} />}

      {activeTab === "captains" && <CaptainsReportView data={initialData} />}

      {activeTab === "classes_plans" && (
        <ClassesPlansView
          data={initialData}
          statusFilter={statusFilter}
          onStatusChange={(val) => updateParams({ status: val })}
          onExport={exportCSV}
          isPending={isPending}
        />
      )}

      {activeTab === "products_finance" && (
        <ProductsFinanceView
          data={initialData}
          categoryFilter={categoryFilter}
          from={fromDate}
          searchFilter={searchFilter}
          to={toDate}
          onCategoryChange={(val) => updateParams({ category: val })}
          onSearchChange={(val) => updateParams({ search: val })}
          onExport={exportCSV}
          isPending={isPending}
        />
      )}

      {activeTab === "subs_shifts" && (
        <SubsShiftsView
          data={initialData}
          statusFilter={statusFilter}
          onStatusChange={(val) => updateParams({ status: val })}
          onExport={exportCSV}
          isPending={isPending}
        />
      )}

      {activeTab === "income_outcome" && (
        <IncomeOutcomeView data={initialData} onExport={exportCSV} isPending={isPending} />
      )}
    </div>
  );
}

function ReportsOverviewView({
  data,
  onShortcut,
}: {
  data: Record<string, unknown>;
  onShortcut: (value: number | "this_month" | "last_month" | "ytd") => void;
}) {
  const totals = asRecord(data.totals);
  const daily = asRows(data.daily);
  const dailyPagination = useTablePagination(daily);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ReportMetric
          title="POS sales"
          value={currency(totals.pos_sales)}
          detail={`${Number(totals.pos_orders ?? 0)} orders`}
        />
        <ReportMetric
          title="Membership revenue"
          value={currency(totals.membership_revenue)}
          detail={`${Number(totals.memberships ?? 0)} memberships`}
        />
        <ReportMetric title="Expenses" value={currency(totals.expenses)} detail="Recorded expenses" destructive />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Daily sales & expenses</CardTitle>
            <CardDescription>Each row uses the selected calendar date range.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={() => onShortcut(7)}>
              Expenses: last 7 days
            </Button>
            <Button size="sm" variant="outline" onClick={() => onShortcut("this_month")}>
              Expenses: this month
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>POS sales</TableHead>
                <TableHead>Expenses</TableHead>
                <TableHead>Memberships</TableHead>
                <TableHead>Membership paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyPagination.pageRows.map((row) => (
                <TableRow key={String(row.date)}>
                  <TableCell className="font-medium">{String(row.date ?? "-")}</TableCell>
                  <TableCell>{currency(row.pos_sales)}</TableCell>
                  <TableCell className="text-destructive">{currency(row.expenses)}</TableCell>
                  <TableCell>{String(row.memberships ?? 0)}</TableCell>
                  <TableCell>{currency(row.membership_revenue)}</TableCell>
                </TableRow>
              ))}
              {daily.length === 0 ? <EmptyTableRow columns={5} label="No activity in this date range." /> : null}
              <TablePagination columns={5} pagination={dailyPagination} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeeSubscriptionDetailsDialog({
  employee,
  from,
  to,
}: {
  employee: Record<string, unknown>;
  from: string;
  to: string;
}) {
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isLoading, startTransition] = useTransition();
  const subscriptions = asRows(details?.subscriptions);
  const subscriptionPagination = useTablePagination(subscriptions);
  const employeeId = Number(employee.employee_id);
  const employeeName = String(employee.name ?? "Employee");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen || details || isLoading) return;

    setError(null);
    startTransition(async () => {
      try {
        setDetails(await getEmployeeSubscriptionDetails(employeeId, from, to));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Could not load employee subscriptions.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <FileText />
        Details
      </DialogTrigger>
      <DialogContent className="max-h-[80dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[calc(100vw-4rem)] xl:max-w-7xl">
        <DialogHeader>
          <DialogTitle>{employeeName}&apos;s subscription sales</DialogTitle>
          <DialogDescription>Subscriptions and renewals sold in the selected date range.</DialogDescription>
        </DialogHeader>

        {isLoading ? <p className="text-muted-foreground text-sm">Loading subscription details…</p> : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {!isLoading && !error ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptionPagination.pageRows.map((subscription) => (
                  <TableRow key={String(subscription.id)}>
                    <TableCell className="font-medium">
                      <div>{String(subscription.member_name ?? "-")}</div>
                      <div className="text-muted-foreground text-xs">{String(subscription.member_code ?? "")}</div>
                    </TableCell>
                    <TableCell>
                      <div>{String(subscription.member_phone ?? "-")}</div>
                      <div className="text-muted-foreground text-xs">{String(subscription.member_email ?? "")}</div>
                    </TableCell>
                    <TableCell>{String(subscription.plan_name ?? "-")}</TableCell>
                    <TableCell>
                      {subscription.type === "renewal"
                        ? "Renewal"
                        : subscription.type === "add_on"
                          ? "Extra plan"
                          : "New subscription"}
                    </TableCell>
                    <TableCell>{currency(subscription.price_paid)}</TableCell>
                    <TableCell>
                      {String(subscription.start_date ?? "-")} – {String(subscription.end_date ?? "-")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {String(subscription.lifecycle_status ?? subscription.status ?? "-")}
                      </Badge>
                      {Number(subscription.refund_total ?? 0) > 0 ? (
                        <div className="mt-1 text-muted-foreground text-xs">
                          Refunded: {currency(subscription.refund_total)}
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
                {subscriptions.length === 0 ? (
                  <EmptyTableRow columns={7} label="No subscriptions or renewals were sold in this date range." />
                ) : null}
                <TablePagination columns={7} pagination={subscriptionPagination} />
              </TableBody>
            </Table>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EmployeesReportView({ data, from, to }: { data: Record<string, unknown>; from: string; to: string }) {
  const employees = asRows(data.employees);
  const employeePagination = useTablePagination(employees);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee sales & commission</CardTitle>
        <CardDescription>
          Subscriptions, sales revenue, extra plans sold, and earned commission for the selected dates.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Subscriptions</TableHead>
              <TableHead>Sales</TableHead>
              <TableHead>Sales revenue</TableHead>
              <TableHead>Extra plans sold</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employeePagination.pageRows.map((employee) => (
              <TableRow key={String(employee.employee_id)}>
                <TableCell className="font-medium">{String(employee.name ?? "-")}</TableCell>
                <TableCell>{String(employee.role ?? "-")}</TableCell>
                <TableCell>{String(employee.subscriptions_count ?? 0)}</TableCell>
                <TableCell>{String(employee.sales_count ?? 0)}</TableCell>
                <TableCell>{currency(employee.sales_volume)}</TableCell>
                <TableCell>
                  {String(employee.coached_services_count ?? 0)} · {currency(employee.coached_services_revenue)}
                </TableCell>
                <TableCell>{currency(employee.commissions_earned)}</TableCell>
                <TableCell className="text-right">
                  <EmployeeSubscriptionDetailsDialog employee={employee} from={from} to={to} />
                </TableCell>
              </TableRow>
            ))}
            {employees.length === 0 ? (
              <EmptyTableRow columns={8} label="No employee activity in this date range." />
            ) : null}
            <TablePagination columns={8} pagination={employeePagination} />
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CaptainsReportView({ data }: { data: Record<string, unknown> }) {
  const kpis = asRecord(data.kpis);
  const coaches = asRows(data.coaches);
  const coachPagination = useTablePagination(coaches);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric
          title="Coached plans"
          value={String(kpis.total_coached_addons ?? 0)}
          detail="Services and studio plans"
        />
        <ReportMetric
          title="Subscribers"
          value={String(kpis.total_subscribed_members ?? 0)}
          detail="Unique subscribed members"
        />
        <ReportMetric
          title="Attendance days"
          value={String(kpis.total_attended_days ?? 0)}
          detail="Days with captain sessions"
        />
        <ReportMetric title="Paid revenue" value={currency(kpis.total_addon_revenue)} detail="Coached plan payments" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Captains & session performance</CardTitle>
          <CardDescription>
            Subscribers, paid amount, sessions/visits, and active coached plans for the selected dates.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Captain</TableHead>
                <TableHead>Subscribers</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Visits / days</TableHead>
                <TableHead>Active plans</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coachPagination.pageRows.map((coach) => (
                <TableRow key={String(coach.coach_id)}>
                  <TableCell>
                    <div className="font-medium">{String(coach.coach_name ?? "-")}</div>
                    <div className="text-muted-foreground text-xs">{String(coach.coach_role ?? "")}</div>
                  </TableCell>
                  <TableCell>{String(coach.subscribed_members_count ?? 0)}</TableCell>
                  <TableCell>{currency(coach.total_revenue)}</TableCell>
                  <TableCell>
                    {String(coach.total_visits_count ?? 0)} / {String(coach.attended_days_count ?? 0)} days
                  </TableCell>
                  <TableCell>{String(coach.active_addons_count ?? 0)}</TableCell>
                </TableRow>
              ))}
              {coaches.length === 0 ? (
                <EmptyTableRow columns={5} label="No captain sessions or services in this date range." />
              ) : null}
              <TablePagination columns={5} pagination={coachPagination} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportMetric({
  title,
  value,
  detail,
  destructive = false,
}: {
  title: string;
  value: string;
  detail: string;
  destructive?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="space-y-1 pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className={destructive ? "text-destructive" : ""}>{value}</CardTitle>
        <p className="text-muted-foreground text-xs">{detail}</p>
      </CardHeader>
    </Card>
  );
}

function EmptyTableRow({ columns, label }: { columns: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={columns} className="py-8 text-center text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

const currencyFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2 });

function currency(value: unknown) {
  return `EGP ${currencyFormatter.format(Number(value ?? 0))}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    : [];
}

type TablePaginationState<T> = {
  currentPage: number;
  pageRows: T[];
  setPage: (page: number) => void;
  total: number;
  totalPages: number;
};

function useTablePagination<T>(rows: T[], pageSize = 10): TablePaginationState<T> {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  return {
    currentPage,
    pageRows: rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    setPage,
    total: rows.length,
    totalPages,
  };
}

function TablePagination<T>({ columns, pagination }: { columns: number; pagination: TablePaginationState<T> }) {
  if (pagination.total <= 10) return null;

  return (
    <TableRow>
      <TableCell colSpan={columns}>
        <div className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
          <span>
            Page {pagination.currentPage} of {pagination.totalPages} · {pagination.total} records
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.currentPage === 1}
              onClick={() => pagination.setPage(pagination.currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => pagination.setPage(pagination.currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function parseReportDate(value: string) {
  if (!value) return undefined;
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// ---------------------------------------------------------------------------
// 1. Classes & Plans View
// ---------------------------------------------------------------------------
function ClassesPlansView({
  data,
  statusFilter,
  onStatusChange,
  onExport,
  isPending,
}: {
  data: Record<string, unknown>;
  statusFilter: string;
  onStatusChange: (val: string) => void;
  onExport: (filename: string, headers: string[], rows: (string | number)[][]) => void;
  isPending: boolean;
}) {
  const locale = useLocale();
  const totals = (data.totals as Record<string, unknown>) ?? {};
  const plansSummary = (data.plans_summary as Record<string, unknown>[]) ?? [];
  const subscriptions = (data.subscriptions as Record<string, unknown>[]) ?? [];
  const endingSoonMembers = (data.ending_soon_members as Record<string, unknown>[]) ?? [];
  const endingSoonPagination = useTablePagination(endingSoonMembers);
  const planPagination = useTablePagination(plansSummary);
  const subscriptionPagination = useTablePagination(subscriptions);

  function handleExport() {
    const headers = [
      "Member Name",
      "Plan Name",
      "Start Date",
      "End Date",
      "Days Left",
      "Sessions Left",
      "Status",
      "Attention Reason",
      "Price Paid",
      "Sold By",
    ];
    const rows = subscriptions.map((s) => [
      String(s.member_name ?? ""),
      String(s.plan_name ?? ""),
      String(s.start_date ?? ""),
      String(s.end_date ?? ""),
      String(s.days_left ?? "N/A"),
      String(s.sessions_text ?? "Unlimited"),
      String(s.status ?? ""),
      String(s.attention_reason ?? "normal"),
      String(s.price_paid ?? "0.00"),
      String(s.sold_by ?? ""),
    ]);
    onExport("classes_plans_report", headers, rows);
  }

  function handleExportEndingSoon() {
    const headers = [
      "Member Name",
      "Plan Name",
      "End Date",
      "Days Left",
      "Sessions Remaining",
      "Reason",
      "Price Paid",
      "Sold By",
    ];
    const rows = endingSoonMembers.map((s) => [
      String(s.member_name ?? ""),
      String(s.plan_name ?? ""),
      String(s.end_date ?? ""),
      String(s.days_left ?? "N/A"),
      String(s.sessions_text ?? "Unlimited"),
      String(s.attention_reason ?? "ending_soon"),
      String(s.price_paid ?? "0.00"),
      String(s.sold_by ?? ""),
    ]);
    onExport("ending_soon_members_report", headers, rows);
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Members</CardDescription>
            <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
              {String(totals.active_members ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ending Soon (Date/Sessions)</CardDescription>
            <CardTitle className="text-2xl text-amber-600 dark:text-amber-400">
              {String(totals.ending_soon_total ?? totals.expiring_soon ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Low Sessions (≤ 3)</CardDescription>
            <CardTitle className="text-2xl text-amber-600 dark:text-amber-400">
              {String(totals.low_sessions ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expired Members</CardDescription>
            <CardTitle className="text-2xl text-rose-600 dark:text-rose-400">
              {String(totals.expired_members ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Period Revenue</CardDescription>
            <CardTitle className="text-2xl">EGP {String(totals.total_revenue_period ?? "0.00")}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Dedicated Members Ending Soon or Low Sessions Table */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-amber-700 text-lg dark:text-amber-300">
              Members Finishing Plan or Low Sessions
            </CardTitle>
            <CardDescription>Members whose plan ends within 7 days or have ≤ 3 remaining sessions</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleExportEndingSoon}>
            <Download className="me-1.5 size-4" /> Export Ending List
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Days Left</TableHead>
                <TableHead>Sessions (Remaining / Total)</TableHead>
                <TableHead>Attention Reason</TableHead>
                <TableHead>Price Paid</TableHead>
                <TableHead>Sold By</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endingSoonPagination.pageRows.map((sub) => {
                const daysLeft = sub.days_left !== null && sub.days_left !== undefined ? Number(sub.days_left) : null;
                const reason = String(sub.attention_reason ?? "ending_soon");

                const isSessionsFinished =
                  sub.sessions_total !== null && Number(sub.sessions_total) > 0 && Number(sub.sessions_remaining) <= 0;
                const isMonthFinished = daysLeft !== null && daysLeft <= 0;

                const finishedSessionsButNotMonth = isSessionsFinished && !isMonthFinished;
                const finishedMonthButNotSessions = isMonthFinished && !isSessionsFinished;
                const finishedBoth = isMonthFinished && isSessionsFinished;

                const showWhatsApp = finishedSessionsButNotMonth || finishedMonthButNotSessions || finishedBoth;

                let _whatsappUrl = "";
                if (showWhatsApp && sub.member_phone) {
                  let cleanPhone = String(sub.member_phone).replace(/\D/g, "");
                  if (cleanPhone.startsWith("01") && cleanPhone.length === 11) {
                    cleanPhone = `2${cleanPhone}`;
                  }

                  let message = "";
                  if (locale === "ar") {
                    if (finishedSessionsButNotMonth) {
                      message = `مرحباً ${sub.member_name}، لقد انتهت جميع الجلسات الخاصة باشتراكك (${sub.plan_name})، ولكن فترة الاشتراك لا تزال نشطة. هل تود تجديد الاشتراك أو شحن جلسات إضافية؟`;
                    } else if (finishedMonthButNotSessions) {
                      message = `مرحباً ${sub.member_name}، لقد انتهت فترة صلاحية اشتراكك في (${sub.plan_name})، ولكن لا يزال لديك جلسات غير مستخدمة (${sub.sessions_text}). هل تود تجديد اشتراكك؟`;
                    } else if (finishedBoth) {
                      message = `مرحباً ${sub.member_name}، لقد انتهت فترة اشتراكك في (${sub.plan_name}) ونفدت جميع الجلسات. هل تود تجديد اشتراكك؟`;
                    }
                  } else {
                    if (finishedSessionsButNotMonth) {
                      message = `Hello ${sub.member_name}, we noticed that you have finished all sessions of your subscription (${sub.plan_name}), but your membership time is still active. Would you like to renew or top up?`;
                    } else if (finishedMonthButNotSessions) {
                      message = `Hello ${sub.member_name}, we noticed that your subscription to ${sub.plan_name} has expired, but you still have unused sessions (${sub.sessions_text}) remaining. Would you like to renew your plan?`;
                    } else if (finishedBoth) {
                      message = `Hello ${sub.member_name}, your subscription to ${sub.plan_name} has expired and you have finished all sessions. Would you like to renew your plan?`;
                    }
                  }
                  _whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
                }

                return (
                  <TableRow key={String(sub.id)}>
                    <TableCell className="font-medium">{String(sub.member_name)}</TableCell>
                    <TableCell>{String(sub.plan_name)}</TableCell>
                    <TableCell>{String(sub.end_date ?? "N/A")}</TableCell>
                    <TableCell>
                      {daysLeft !== null ? (
                        <Badge
                          variant="outline"
                          className={
                            daysLeft <= 3
                              ? "border-rose-500/20 bg-rose-500/10 text-rose-600"
                              : "border-amber-500/20 bg-amber-500/10 text-amber-600"
                          }
                        >
                          {daysLeft} days
                        </Badge>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          Number(sub.sessions_remaining) <= 3 && Number(sub.sessions_total) > 0
                            ? "border-amber-500/20 bg-amber-500/10 font-bold text-amber-600"
                            : ""
                        }
                      >
                        {String(sub.sessions_text ?? "Unlimited")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          reason === "both"
                            ? "border-rose-500/20 bg-rose-500/10 font-semibold text-rose-600"
                            : reason === "low_sessions"
                              ? "border-amber-500/20 bg-amber-500/10 text-amber-600"
                              : "border-blue-500/20 bg-blue-500/10 text-blue-600"
                        }
                      >
                        {reason === "both"
                          ? "Low Sessions & Expiring Soon"
                          : reason === "low_sessions"
                            ? "Low Sessions (≤ 3)"
                            : "Expiring Soon (Date)"}
                      </Badge>
                    </TableCell>
                    <TableCell>EGP {String(sub.price_paid)}</TableCell>
                    <TableCell>{String(sub.sold_by)}</TableCell>
                    <TableCell className="text-right">
                      {sub.member_phone ? (
                        <WhatsAppNotificationButton
                          phone={String(sub.member_phone)}
                          data={{
                            member_name: sub.member_name,
                            plan_name: sub.plan_name,
                            end_date: sub.end_date,
                            sessions_remaining: sub.sessions_remaining,
                          }}
                          size="sm"
                        />
                      ) : (
                        <span className="font-normal text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {endingSoonMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                    No members currently ending plan or low on sessions.
                  </TableCell>
                </TableRow>
              )}
              <TablePagination columns={9} pagination={endingSoonPagination} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Plans Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Membership Plans Overview</CardTitle>
          <CardDescription>Member counts and revenue per plan</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Active Members</TableHead>
                <TableHead>Ending / Low Sessions</TableHead>
                <TableHead>Expired</TableHead>
                <TableHead>New Subs (Period)</TableHead>
                <TableHead className="text-end">Revenue (Period)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planPagination.pageRows.map((plan) => (
                <TableRow key={String(plan.id)}>
                  <TableCell className="font-medium">{String(plan.name)}</TableCell>
                  <TableCell>EGP {String(plan.price)}</TableCell>
                  <TableCell>{String(plan.duration_days)} days</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                      {String(plan.active_members)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-600">
                      {String(plan.expiring_soon)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-rose-500/20 bg-rose-500/10 text-rose-600">
                      {String(plan.expired_members)}
                    </Badge>
                  </TableCell>
                  <TableCell>{String(plan.new_subscriptions_period)}</TableCell>
                  <TableCell className="text-end font-semibold">EGP {String(plan.revenue_period)}</TableCell>
                </TableRow>
              ))}
              {plansSummary.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                    No plan records found.
                  </TableCell>
                </TableRow>
              )}
              <TablePagination columns={8} pagination={planPagination} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Subscription Members List Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Subscriptions & Members Details</CardTitle>
            <CardDescription>Individual subscription breakdown and session tracking</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <FormSelect
              name="status"
              defaultValue={statusFilter}
              placeholder="All Statuses"
              options={[
                { label: "All Statuses", value: "" },
                { label: "Active", value: "active" },
                { label: "Ending Soon (Date & Sessions)", value: "ending_soon" },
                { label: "Low Sessions (≤ 3 Left)", value: "low_sessions" },
                { label: "Expiring by Date (7 Days)", value: "expiring_soon" },
                { label: "Expired", value: "expired" },
                { label: "Stopped", value: "stopped" },
              ]}
              onValueChange={(val) => onStatusChange(val)}
            />
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="me-1.5 size-4" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Days Left</TableHead>
                <TableHead>Sessions (Remaining / Total)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price Paid</TableHead>
                <TableHead>Sold By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptionPagination.pageRows.map((sub) => {
                const daysLeft = sub.days_left !== null && sub.days_left !== undefined ? Number(sub.days_left) : null;
                const reason = String(sub.attention_reason ?? "normal");

                return (
                  <TableRow key={String(sub.id)}>
                    <TableCell className="font-medium">{String(sub.member_name)}</TableCell>
                    <TableCell>{String(sub.plan_name)}</TableCell>
                    <TableCell>{String(sub.start_date ?? "N/A")}</TableCell>
                    <TableCell>{String(sub.end_date ?? "N/A")}</TableCell>
                    <TableCell>
                      {daysLeft !== null ? (
                        <Badge
                          variant="outline"
                          className={
                            daysLeft <= 3
                              ? "border-rose-500/20 bg-rose-500/10 text-rose-600"
                              : daysLeft <= 7
                                ? "border-amber-500/20 bg-amber-500/10 text-amber-600"
                                : ""
                          }
                        >
                          {daysLeft} days
                        </Badge>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          Number(sub.sessions_remaining) <= 3 && Number(sub.sessions_total) > 0
                            ? "border-amber-500/20 bg-amber-500/10 font-bold text-amber-600"
                            : ""
                        }
                      >
                        {String(sub.sessions_text ?? "Unlimited")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={sub.status === "active" ? "default" : "secondary"}
                        className={
                          reason === "low_sessions" || reason === "expiring_soon" || reason === "both"
                            ? "bg-amber-500 text-white"
                            : ""
                        }
                      >
                        {String(sub.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>EGP {String(sub.price_paid)}</TableCell>
                    <TableCell>{String(sub.sold_by)}</TableCell>
                  </TableRow>
                );
              })}
              {subscriptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                    No subscriptions match selected filters.
                  </TableCell>
                </TableRow>
              )}
              <TablePagination columns={9} pagination={subscriptionPagination} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Products & POS View
// ---------------------------------------------------------------------------
function ProductSaleDetailsDialog({
  product,
  from,
  to,
}: {
  product: Record<string, unknown>;
  from: string;
  to: string;
}) {
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isLoading, startTransition] = useTransition();
  const sales = asRows(details?.product_sales);
  const salePagination = useTablePagination(sales);
  const productId = Number(product.id);
  const productName = String(product.name ?? "Product");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen || details || isLoading) return;

    setError(null);
    startTransition(async () => {
      try {
        setDetails(await getProductSaleDetails(productId, from, to));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Could not load product sales.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <FileText />
        Details
      </DialogTrigger>
      <DialogContent className="max-h-[80dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[calc(100vw-4rem)] xl:max-w-7xl">
        <DialogHeader>
          <DialogTitle>{productName} sales</DialogTitle>
          <DialogDescription>
            Every completed sale for this product in the selected date range. Net received accounts for the
            product&apos;s share of an order discount.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? <p className="text-muted-foreground text-sm">Loading sale details…</p> : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {!isLoading && !error ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit price</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Net received</TableHead>
                  <TableHead>Net profit</TableHead>
                  <TableHead>Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salePagination.pageRows.map((sale) => (
                  <TableRow key={String(sale.sale_id)}>
                    <TableCell>{String(sale.sold_at ?? "-")}</TableCell>
                    <TableCell>
                      <div className="font-medium">{String(sale.member_name ?? "Walk-in customer")}</div>
                      <div className="text-muted-foreground text-xs">
                        {String(sale.member_phone ?? sale.member_email ?? "")}
                      </div>
                    </TableCell>
                    <TableCell>{String(sale.seller_name ?? "-")}</TableCell>
                    <TableCell>{String(sale.quantity ?? 0)}</TableCell>
                    <TableCell>{currency(sale.unit_price)}</TableCell>
                    <TableCell>{currency(sale.line_subtotal)}</TableCell>
                    <TableCell>
                      <div>{currency(sale.allocated_discount)}</div>
                      {Number(sale.order_discount ?? 0) > 0 ? (
                        <div className="text-muted-foreground text-xs">Order: {currency(sale.order_discount)}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium text-emerald-600 dark:text-emerald-400">
                      {currency(sale.net_received)}
                    </TableCell>
                    <TableCell className="font-medium text-emerald-600 dark:text-emerald-400">
                      {currency(sale.net_profit)}
                      <div className="text-muted-foreground text-xs">Cost: {currency(sale.unit_cost)}/unit</div>
                    </TableCell>
                    <TableCell>{String(sale.payment_method ?? "-")}</TableCell>
                  </TableRow>
                ))}
                {sales.length === 0 ? (
                  <EmptyTableRow columns={10} label="No completed sales in this date range." />
                ) : null}
                <TablePagination columns={10} pagination={salePagination} />
              </TableBody>
            </Table>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProductsFinanceView({
  data,
  categoryFilter,
  from,
  searchFilter,
  to,
  onCategoryChange,
  onSearchChange,
  onExport,
  isPending,
}: {
  data: Record<string, unknown>;
  categoryFilter: string;
  from: string;
  searchFilter: string;
  to: string;
  onCategoryChange: (val: string) => void;
  onSearchChange: (val: string) => void;
  onExport: (filename: string, headers: string[], rows: (string | number)[][]) => void;
  isPending: boolean;
}) {
  const totals = (data.totals as Record<string, unknown>) ?? {};
  const productsSummary = (data.products_summary as Record<string, unknown>[]) ?? [];
  const transactions = (data.transactions as Record<string, unknown>[]) ?? [];
  const productPagination = useTablePagination(productsSummary);
  const transactionPagination = useTablePagination(transactions);

  function handleExport() {
    const headers = [
      "Product Name",
      "Category",
      "Stock",
      "Units Sold",
      "Price",
      "Cost",
      "Net Revenue",
      "Net Profit",
      "Status",
    ];
    const rows = productsSummary.map((p) => [
      String(p.name ?? ""),
      String(p.category ?? ""),
      String(p.stock_quantity ?? 0),
      String(p.units_sold_period ?? 0),
      String(p.price ?? "0.00"),
      String(p.cost ?? "0.00"),
      String(p.net_revenue_period ?? "0.00"),
      String(p.net_profit_period ?? "0.00"),
      String(p.status ?? ""),
    ]);
    onExport("products_pos_report", headers, rows);
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total POS Revenue</CardDescription>
            <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
              EGP {String(totals.total_pos_revenue ?? "0.00")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Orders</CardDescription>
            <CardTitle className="text-2xl">{String(totals.total_orders ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Units Sold</CardDescription>
            <CardTitle className="text-2xl">{String(totals.total_units_sold ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Low Stock Alerts</CardDescription>
            <CardTitle className="text-2xl text-amber-600 dark:text-amber-400">
              {String(totals.low_stock_products_count ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Products Summary Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Products & Inventory Performance</CardTitle>
            <CardDescription>Sales volume and revenue per product</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search product..."
                defaultValue={searchFilter}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-9 ps-8 text-xs"
              />
            </div>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="me-1.5 size-4" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Units Sold (Period)</TableHead>
                <TableHead className="text-end">Net revenue</TableHead>
                <TableHead className="text-end">Net profit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productPagination.pageRows.map((prod) => (
                <TableRow key={String(prod.id)}>
                  <TableCell className="font-medium">{String(prod.name)}</TableCell>
                  <TableCell>{String(prod.category)}</TableCell>
                  <TableCell>EGP {String(prod.price)}</TableCell>
                  <TableCell>EGP {String(prod.cost)}</TableCell>
                  <TableCell>{String(prod.stock_quantity)}</TableCell>
                  <TableCell className="font-semibold">{String(prod.units_sold_period)}</TableCell>
                  <TableCell className="text-end font-semibold text-emerald-600 dark:text-emerald-400">
                    EGP {String(prod.net_revenue_period)}
                  </TableCell>
                  <TableCell className="text-end font-semibold text-emerald-600 dark:text-emerald-400">
                    EGP {String(prod.net_profit_period)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        prod.status === "in_stock"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                          : prod.status === "low_stock"
                            ? "border-amber-500/20 bg-amber-500/10 text-amber-600"
                            : "border-rose-500/20 bg-rose-500/10 text-rose-600"
                      }
                    >
                      {String(prod.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ProductSaleDetailsDialog
                      key={`${String(prod.id)}-${from}-${to}`}
                      product={prod}
                      from={from}
                      to={to}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {productsSummary.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">
                    No products found matching criteria.
                  </TableCell>
                </TableRow>
              )}
              <TablePagination columns={10} pagination={productPagination} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* POS Transactions List Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent POS Sales Transactions</CardTitle>
          <CardDescription>Individual order logs and payment details</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Items Count</TableHead>
                <TableHead className="text-end">Total Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactionPagination.pageRows.map((tx) => (
                <TableRow key={String(tx.id)}>
                  <TableCell className="font-medium">{String(tx.id)}</TableCell>
                  <TableCell>{String(tx.customer_name)}</TableCell>
                  <TableCell>{String(tx.seller_name)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{String(tx.payment_method)}</Badge>
                  </TableCell>
                  <TableCell>{String(tx.items_count)} items</TableCell>
                  <TableCell className="text-end font-semibold">EGP {String(tx.total_amount)}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No sales transactions recorded in selected period.
                  </TableCell>
                </TableRow>
              )}
              <TablePagination columns={6} pagination={transactionPagination} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Subscriptions & Shifts View
// ---------------------------------------------------------------------------
function SubsShiftsView({
  data,
  statusFilter,
  onStatusChange,
  onExport,
  isPending,
}: {
  data: Record<string, unknown>;
  statusFilter: string;
  onStatusChange: (val: string) => void;
  onExport: (filename: string, headers: string[], rows: (string | number)[][]) => void;
  isPending: boolean;
}) {
  const totals = (data.totals as Record<string, unknown>) ?? {};
  const shifts = (data.shifts as Record<string, unknown>[]) ?? [];
  const shiftPagination = useTablePagination(shifts);

  function handleExport() {
    const headers = [
      "Shift ID",
      "Shift Name",
      "Opened By",
      "Closed By",
      "Status",
      "Subscription Sales",
      "POS Sales",
      "Total Revenue",
      "Expected Cash",
      "Counted Cash",
      "Discrepancy",
    ];
    const rows = shifts.map((s) => [
      String(s.id ?? ""),
      String(s.shift_name ?? ""),
      String(s.opened_by ?? ""),
      String(s.closed_by ?? ""),
      String(s.status ?? ""),
      String(s.subscription_sales_amount ?? "0.00"),
      String(s.pos_sales_amount ?? "0.00"),
      String(s.total_revenue ?? "0.00"),
      String(s.expected_cash ?? "0.00"),
      String(s.counted_cash ?? "N/A"),
      String(s.discrepancy ?? "0.00"),
    ]);
    onExport("shifts_revenue_report", headers, rows);
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Shifts</CardDescription>
            <CardTitle className="text-2xl">{String(totals.total_shifts_count ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sub Sales (In Shifts)</CardDescription>
            <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
              EGP {String(totals.total_subscription_revenue ?? "0.00")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>POS Sales (In Shifts)</CardDescription>
            <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
              EGP {String(totals.total_pos_revenue ?? "0.00")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Shift Discrepancy</CardDescription>
            <CardTitle className="text-2xl text-amber-600 dark:text-amber-400">
              EGP {String(totals.total_cash_discrepancy ?? "0.00")}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Shifts Breakdown Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Staff Shift Sessions Revenue Breakdown</CardTitle>
            <CardDescription>Money collected from subscriptions & POS per shift</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <FormSelect
              name="status"
              defaultValue={statusFilter}
              placeholder="All Statuses"
              options={[
                { label: "All Statuses", value: "" },
                { label: "Open", value: "open" },
                { label: "Pending Review", value: "pending_review" },
                { label: "Accepted", value: "accepted" },
              ]}
              onValueChange={(val) => onStatusChange(val)}
            />
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="me-1.5 size-4" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shift #</TableHead>
                <TableHead>Opened By</TableHead>
                <TableHead>Closed By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Subs Sales</TableHead>
                <TableHead>POS Sales</TableHead>
                <TableHead className="text-end">Total Shift Income</TableHead>
                <TableHead>Expected Cash</TableHead>
                <TableHead>Counted Cash</TableHead>
                <TableHead>Discrepancy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shiftPagination.pageRows.map((s) => (
                <TableRow key={String(s.id)}>
                  <TableCell className="font-medium">#{String(s.id)}</TableCell>
                  <TableCell>{String(s.opened_by)}</TableCell>
                  <TableCell>{String(s.closed_by)}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "accepted" ? "default" : "secondary"}>{String(s.status)}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-emerald-600">
                    EGP {String(s.subscription_sales_amount)}
                  </TableCell>
                  <TableCell className="font-medium text-emerald-600">EGP {String(s.pos_sales_amount)}</TableCell>
                  <TableCell className="text-end font-bold">EGP {String(s.total_revenue)}</TableCell>
                  <TableCell>EGP {String(s.expected_cash)}</TableCell>
                  <TableCell>{s.counted_cash ? `EGP ${s.counted_cash}` : "N/A"}</TableCell>
                  <TableCell className={Number(s.discrepancy) < 0 ? "font-semibold text-rose-600" : ""}>
                    EGP {String(s.discrepancy)}
                  </TableCell>
                </TableRow>
              ))}
              {shifts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-6 text-center text-muted-foreground">
                    No shift sessions found.
                  </TableCell>
                </TableRow>
              )}
              <TablePagination columns={10} pagination={shiftPagination} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Income vs Outcome View
// ---------------------------------------------------------------------------
function IncomeOutcomeView({
  data,
  onExport,
  isPending,
}: {
  data: Record<string, unknown>;
  onExport: (filename: string, headers: string[], rows: (string | number)[][]) => void;
  isPending: boolean;
}) {
  const totals = (data.totals as Record<string, unknown>) ?? {};
  const timeline = (data.timeline as Record<string, unknown>[]) ?? [];
  const timelinePagination = useTablePagination(timeline);

  function handleExport() {
    const headers = [
      "Period",
      "Sub Income",
      "POS Income",
      "Total Income",
      "Expenses",
      "Payroll",
      "Refunds",
      "Total Outcome",
      "Net Profit",
    ];
    const rows = timeline.map((t) => [
      String(t.period ?? ""),
      String(t.subscription_income ?? "0.00"),
      String(t.pos_income ?? "0.00"),
      String(t.total_income ?? "0.00"),
      String(t.expenses_outcome ?? "0.00"),
      String(t.payroll_outcome ?? "0.00"),
      String(t.refunds_outcome ?? "0.00"),
      String(t.total_outcome ?? "0.00"),
      String(t.net_profit ?? "0.00"),
    ]);
    onExport("income_outcome_report", headers, rows);
  }

  const netProfitNum = Number(totals.net_profit ?? 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Income</CardDescription>
            <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
              EGP {String(totals.total_income ?? "0.00")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Outcome (Expenses/Payroll)</CardDescription>
            <CardTitle className="text-2xl text-rose-600 dark:text-rose-400">
              EGP {String(totals.total_outcome ?? "0.00")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Profit / Cashflow</CardDescription>
            <CardTitle
              className={`text-2xl ${netProfitNum >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
            >
              EGP {String(totals.net_profit ?? "0.00")}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Profit Margin</CardDescription>
            <CardTitle className="text-2xl">{String(totals.profit_margin ?? "0.00")}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Income vs Outcome Timeline Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Daily / Monthly Cashflow Breakdown</CardTitle>
            <CardDescription>Detailed income sources vs expense/payroll outcomes</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="me-1.5 size-4" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / Period</TableHead>
                <TableHead>Subscriptions</TableHead>
                <TableHead>POS Sales</TableHead>
                <TableHead className="font-semibold text-emerald-600">Total Income</TableHead>
                <TableHead>Expenses</TableHead>
                <TableHead>Payroll</TableHead>
                <TableHead>Refunds</TableHead>
                <TableHead className="font-semibold text-rose-600">Total Outcome</TableHead>
                <TableHead className="text-end font-bold">Net Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timelinePagination.pageRows.map((row) => (
                <TableRow key={String(row.period)}>
                  <TableCell className="font-medium">{String(row.period)}</TableCell>
                  <TableCell>EGP {String(row.subscription_income)}</TableCell>
                  <TableCell>EGP {String(row.pos_income)}</TableCell>
                  <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                    EGP {String(row.total_income)}
                  </TableCell>
                  <TableCell>EGP {String(row.expenses_outcome)}</TableCell>
                  <TableCell>EGP {String(row.payroll_outcome)}</TableCell>
                  <TableCell>EGP {String(row.refunds_outcome)}</TableCell>
                  <TableCell className="font-semibold text-rose-600 dark:text-rose-400">
                    EGP {String(row.total_outcome)}
                  </TableCell>
                  <TableCell
                    className={`text-end font-bold ${Number(row.net_profit) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                  >
                    EGP {String(row.net_profit)}
                  </TableCell>
                </TableRow>
              ))}
              {timeline.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                    No cashflow records found for selected period.
                  </TableCell>
                </TableRow>
              )}
              <TablePagination columns={9} pagination={timelinePagination} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
