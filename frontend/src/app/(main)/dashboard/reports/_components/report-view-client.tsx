"use client";

import { type ReactNode, useMemo, useState, useTransition } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { format, parseISO } from "date-fns";
import {
  Banknote,
  BarChart3,
  Calendar,
  Download,
  FileText,
  History,
  IdCard,
  Package,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import { getMemberSubscriptionHistory, getSubscriptionDetail } from "./member-subscriptions-actions";

type ReportViewClientProps = {
  initialType: string;
  initialQuery: Record<string, string | undefined>;
  initialData: Record<string, unknown>;
};

// Labels like "Member Subscriptions" cannot sit on one line in a narrow grid
// cell, so on phones the icon stacks above wrapped text instead of overflowing.
const reportTabTriggerClass =
  "h-auto min-w-0 flex-col gap-1 whitespace-normal px-2 py-1.5 text-center text-xs leading-tight sm:flex-row sm:gap-2 sm:text-sm";

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
        {/* The list wraps to 2 rows on phones, so the primitive's fixed h-8 has to
            go — otherwise every row is squashed into 32px total. */}
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 group-data-horizontal/tabs:h-auto md:grid-cols-4 xl:grid-cols-8">
          <TabsTrigger value="overview" className={reportTabTriggerClass}>
            <Calendar className="size-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="employees" className={reportTabTriggerClass}>
            <Users className="size-4" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="captains" className={reportTabTriggerClass}>
            <UserRound className="size-4" />
            Captains
          </TabsTrigger>
          <TabsTrigger value="classes_plans" className={reportTabTriggerClass}>
            <Users className="size-4" />
            Classes & Plans
          </TabsTrigger>
          <TabsTrigger value="products_finance" className={reportTabTriggerClass}>
            <Package className="size-4" />
            Products & POS
          </TabsTrigger>
          <TabsTrigger value="member_subscriptions" className={reportTabTriggerClass}>
            <IdCard className="size-4" />
            Member Subscriptions
          </TabsTrigger>
          <TabsTrigger value="subs_shifts" className={reportTabTriggerClass}>
            <BarChart3 className="size-4" />
            Subscriptions & Shifts
          </TabsTrigger>
          <TabsTrigger value="income_outcome" className={reportTabTriggerClass}>
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

      {activeTab === "captains" && <CaptainsReportView data={initialData} from={fromDate} to={toDate} />}

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

      {activeTab === "member_subscriptions" && (
        <MemberSubscriptionsView
          data={initialData}
          statusFilter={statusFilter}
          searchFilter={searchFilter}
          onStatusChange={(val) => updateParams({ status: val })}
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

function EmployeeDetailsDialog({
  employee,
  from,
  to,
}: {
  employee: Record<string, unknown>;
  from: string;
  to: string;
}) {
  const t = useTranslations("Dashboard.reports.employeePerformance");
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isLoading, startTransition] = useTransition();
  const subscriptions = asRows(details?.subscriptions);
  const commissions = asRows(details?.commissions);
  const subscriptionPagination = useTablePagination(subscriptions);
  const commissionPagination = useTablePagination(commissions);
  const employeeId = Number(employee.employee_id);
  const employeeName = String(employee.name ?? t("employeeFallback"));

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen || details || isLoading) return;

    setError(null);
    startTransition(async () => {
      try {
        setDetails(await getEmployeeSubscriptionDetails(employeeId, from, to));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : t("loadError"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <FileText />
        {t("details")}
      </DialogTrigger>
      <DialogContent className="max-h-[80dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[calc(100vw-4rem)] xl:max-w-7xl">
        <DialogHeader>
          <DialogTitle>{t("detailsTitle", { name: employeeName })}</DialogTitle>
          <DialogDescription>{t("detailsDescription", { from, to })}</DialogDescription>
        </DialogHeader>

        {isLoading ? <p className="text-muted-foreground text-sm">{t("loading")}</p> : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {!isLoading && !error ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ReportMetric
                title={t("membershipsSold")}
                value={String(employee.subscriptions_count ?? 0)}
                detail={t("sellerMetric")}
              />
              <ReportMetric
                title={t("posSales")}
                value={currency(employee.sales_volume)}
                detail={t("orders", { count: Number(employee.sales_count ?? 0) })}
              />
              <ReportMetric
                title={t("earned")}
                value={currency(employee.commissions_positive)}
                detail={t("positiveCommissions")}
              />
              <ReportMetric
                title={t("netCommission")}
                value={currency(employee.commissions_earned)}
                detail={t("reversedDetail", { amount: currency(employee.commissions_reversed) })}
                destructive={Number(employee.commissions_earned ?? 0) < 0}
              />
            </div>

            <section className="space-y-2">
              <div>
                <h3 className="font-semibold text-sm">{t("commissionLedger")}</h3>
                <p className="text-muted-foreground text-xs">{t("commissionLedgerDescription")}</p>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("source")}</TableHead>
                      <TableHead>{t("reason")}</TableHead>
                      <TableHead>{t("calculation")}</TableHead>
                      <TableHead>{t("amount")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionPagination.pageRows.map((commission) => {
                      const amount = Number(commission.amount ?? 0);

                      return (
                        <TableRow key={String(commission.id)}>
                          <TableCell className="whitespace-nowrap">{String(commission.occurred_at ?? "-")}</TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {String(commission.plan_name ?? commissionSourceLabel(commission.source_kind, t))}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {String(commission.member_name ?? t("noMember"))}
                              {commission.member_code ? ` · ${String(commission.member_code)}` : ""}
                            </div>
                          </TableCell>
                          <TableCell>{commissionReasonLabel(String(commission.commission_type ?? ""), t)}</TableCell>
                          <TableCell>
                            {commissionCalculationLabel(
                              String(commission.calculation_type ?? ""),
                              commission.rule_value,
                              t,
                            )}
                          </TableCell>
                          <TableCell
                            className={amount < 0 ? "font-semibold text-destructive" : "font-semibold text-emerald-600"}
                          >
                            {currency(amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{String(commission.status ?? "-")}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {commissions.length === 0 ? <EmptyTableRow columns={6} label={t("noCommissions")} /> : null}
                    <TablePagination columns={6} pagination={commissionPagination} />
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-2">
              <div>
                <h3 className="font-semibold text-sm">{t("soldSubscriptions")}</h3>
                <p className="text-muted-foreground text-xs">{t("soldSubscriptionsDescription")}</p>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("member")}</TableHead>
                      <TableHead>{t("contact")}</TableHead>
                      <TableHead>{t("plan")}</TableHead>
                      <TableHead>{t("type")}</TableHead>
                      <TableHead>{t("paid")}</TableHead>
                      <TableHead>{t("period")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
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
                        <TableCell>{subscriptionTypeLabel(String(subscription.type ?? ""), t)}</TableCell>
                        <TableCell>{currency(subscription.price_paid)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {String(subscription.start_date ?? "-")} – {String(subscription.end_date ?? "-")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {String(subscription.lifecycle_status ?? subscription.status ?? "-")}
                          </Badge>
                          {Number(subscription.refund_total ?? 0) > 0 ? (
                            <div className="mt-1 text-muted-foreground text-xs">
                              {t("refundedAmount", { amount: currency(subscription.refund_total) })}
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                    {subscriptions.length === 0 ? <EmptyTableRow columns={7} label={t("noSubscriptions")} /> : null}
                    <TablePagination columns={7} pagination={subscriptionPagination} />
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type EmployeeReportTotals = {
  commissions: number;
  earned: number;
  memberships: number;
  posOrders: number;
  posRevenue: number;
  reversed: number;
};

function EmployeesReportView({ data, from, to }: { data: Record<string, unknown>; from: string; to: string }) {
  const t = useTranslations("Dashboard.reports.employeePerformance");
  const employees = asRows(data.employees);
  const employeePagination = useTablePagination(employees);
  const totals = employees.reduce<EmployeeReportTotals>(
    (summary, employee) => ({
      commissions: summary.commissions + Number(employee.commissions_earned ?? 0),
      earned: summary.earned + Number(employee.commissions_positive ?? 0),
      memberships: summary.memberships + Number(employee.subscriptions_count ?? 0),
      posOrders: summary.posOrders + Number(employee.sales_count ?? 0),
      posRevenue: summary.posRevenue + Number(employee.sales_volume ?? 0),
      reversed: summary.reversed + Number(employee.commissions_reversed ?? 0),
    }),
    { commissions: 0, earned: 0, memberships: 0, posOrders: 0, posRevenue: 0, reversed: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric title={t("membershipsSold")} value={String(totals.memberships)} detail={t("soldByEmployees")} />
        <ReportMetric
          title={t("posRevenue")}
          value={currency(totals.posRevenue)}
          detail={t("orders", { count: totals.posOrders })}
        />
        <ReportMetric title={t("earnedCommission")} value={currency(totals.earned)} detail={t("beforeRefunds")} />
        <ReportMetric
          title={t("netCommission")}
          value={currency(totals.commissions)}
          detail={t("reversedDetail", { amount: currency(totals.reversed) })}
          destructive={totals.commissions < 0}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("activity")}</TableHead>
                <TableHead>{t("posSales")}</TableHead>
                <TableHead>{t("commissionSummary")}</TableHead>
                <TableHead className="text-end">{t("details")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeePagination.pageRows.map((employee) => {
                const netCommission = Number(employee.commissions_earned ?? 0);

                return (
                  <TableRow key={String(employee.employee_id)}>
                    <TableCell>
                      <div className="font-medium">{String(employee.name ?? "-")}</div>
                      <div className="text-muted-foreground text-xs">{String(employee.role ?? "-")}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {t("membershipsSold")}: {String(employee.subscriptions_count ?? 0)}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {t("extraServicesSold")}: {currency(employee.coached_services_revenue)} ·{" "}
                        {t("services", {
                          count: Number(employee.coached_services_count ?? 0),
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{currency(employee.sales_volume)}</div>
                      <div className="text-muted-foreground text-xs">
                        {t("orders", { count: Number(employee.sales_count ?? 0) })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="grid gap-1 text-xs sm:grid-cols-3 sm:gap-3">
                        <span className="text-emerald-600">
                          {t("earned")}: {currency(employee.commissions_positive)}
                        </span>
                        <span
                          className={
                            Number(employee.commissions_reversed ?? 0) > 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }
                        >
                          {t("reversed")}:{" "}
                          {Number(employee.commissions_reversed ?? 0) > 0
                            ? currency(-Number(employee.commissions_reversed))
                            : currency(0)}
                        </span>
                        <span
                          className={
                            netCommission < 0 ? "font-semibold text-destructive" : "font-semibold text-foreground"
                          }
                        >
                          {t("net")}: {currency(netCommission)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-end">
                      <EmployeeDetailsDialog employee={employee} from={from} to={to} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {employees.length === 0 ? <EmptyTableRow columns={5} label={t("empty")} /> : null}
              <TablePagination columns={5} pagination={employeePagination} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CaptainsReportView({ data, from, to }: { data: Record<string, unknown>; from: string; to: string }) {
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
                <TableHead className="text-end">Actions</TableHead>
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
                  <TableCell className="text-end">
                    <CaptainDetailsDialog coach={coach} from={from} to={to} />
                  </TableCell>
                </TableRow>
              ))}
              {coaches.length === 0 ? (
                <EmptyTableRow columns={6} label="No captain sessions or services in this date range." />
              ) : null}
              <TablePagination columns={6} pagination={coachPagination} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

type EmployeeReportT = ReturnType<typeof useTranslations<"Dashboard.reports.employeePerformance">>;

function subscriptionTypeLabel(type: string, t: EmployeeReportT): string {
  if (type === "renewal") return t("renewal");
  if (type === "add_on") return t("extraPlan");

  return t("newSubscription");
}

function commissionSourceLabel(source: unknown, t: EmployeeReportT): string {
  if (source === "extra_service") return t("extraService");
  if (source === "pos_sale") return t("posSale");

  return t("membership");
}

function commissionReasonLabel(type: string, t: EmployeeReportT): string {
  const isRefund = type.endsWith("_refund");
  const baseType = isRefund ? type.slice(0, -"_refund".length) : type;
  let reason = t("otherCommission");

  if (baseType === "subscription_sale") reason = t("membershipSaleCommission");
  if (baseType === "subscription_coach") reason = t("membershipCoachCommission");
  if (baseType === "subscription_addon_sale") reason = t("extraSaleCommission");
  if (baseType === "subscription_addon_coach") reason = t("extraCoachCommission");
  if (baseType === "sale") reason = t("posSaleCommission");

  return isRefund ? t("refundReversalOf", { reason }) : reason;
}

function commissionCalculationLabel(type: string, ruleValue: unknown, t: EmployeeReportT): string {
  if (type === "refund") return t("refundReversal");
  if (type === "percentage") return t("percentageCalculation", { value: Number(ruleValue ?? 0) });
  if (type === "fixed") return t("fixedCalculation", { amount: currency(ruleValue) });

  return t("recordedAmount");
}

function CaptainDetailsDialog({ coach, from, to }: { coach: Record<string, unknown>; from: string; to: string }) {
  const t = useTranslations("Dashboard.reports.captainDetails");
  const members = asRows(coach.members);
  const pagination = useTablePagination(members);
  const coachName = String(coach.coach_name ?? t("captainFallback"));
  const period = from || to ? `${from || "…"} → ${to || "…"}` : t("currentPeriod");

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <FileText />
        {t("details")}
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[calc(100vw-4rem)] xl:max-w-7xl">
        <DialogHeader>
          <DialogTitle>{t("title", { name: coachName })}</DialogTitle>
          <DialogDescription>{t("description", { period })}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <ReportMetric
            title={t("subscribers")}
            value={String(coach.subscribed_members_count ?? 0)}
            detail={t("subscriptionBreakdown", {
              stopped: Number(coach.stopped_subscriptions_count ?? 0),
              total: Number(coach.subscription_rows_count ?? members.length),
            })}
          />
          <ReportMetric title={t("collected")} value={currency(coach.total_revenue)} detail={t("netPayments")} />
          <ReportMetric
            title={t("attendance")}
            value={String(coach.total_visits_count ?? 0)}
            detail={t("attendanceDays", { count: Number(coach.attended_days_count ?? 0) })}
          />
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("member")}</TableHead>
                <TableHead>{t("contact")}</TableHead>
                <TableHead>{t("plan")}</TableHead>
                <TableHead>{t("period")}</TableHead>
                <TableHead>{t("paid")}</TableHead>
                <TableHead>{t("paymentDates")}</TableHead>
                <TableHead>{t("visits")}</TableHead>
                <TableHead>{t("sessions")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.pageRows.map((member) => {
                const attendanceDates = asRows(member.attendance_dates);
                const paymentBreakdown = asRows(member.payment_breakdown);
                const paymentDates = asStringArray(member.payment_dates);
                const sessionsTotal = Number(member.sessions_total ?? 0);
                let sessionsLabel = t("unlimited");
                if (sessionsTotal > 0) {
                  sessionsLabel =
                    member.status === "stopped"
                      ? t("stoppedSessionSummary", {
                          attended: Number(member.sessions_used ?? 0),
                          total: sessionsTotal,
                        })
                      : t("sessionSummary", {
                          remaining: Number(member.sessions_remaining ?? 0),
                          total: sessionsTotal,
                          used: Number(member.sessions_used ?? 0),
                        });
                }
                let paymentHistory: ReactNode = t("noPaymentDate");
                if (paymentDates.length > 0) {
                  paymentHistory = paymentDates.join(", ");
                }
                if (paymentBreakdown.length > 0) {
                  paymentHistory = paymentBreakdown.map((payment) => {
                    const status = String(payment.status ?? "");
                    let statusLabel = t("paidStatus");
                    if (status === "refunded") {
                      statusLabel = t("refundedStatus");
                    } else if (status === "partial") {
                      statusLabel = t("partialStatus");
                    }

                    return (
                      <div className="whitespace-nowrap" key={String(payment.id)}>
                        {String(payment.date ?? "-")} · {currency(payment.amount)} · {statusLabel}
                      </div>
                    );
                  });
                }

                return (
                  <TableRow key={`${String(member.type)}-${String(member.addon_id)}-${String(member.member_id)}`}>
                    <TableCell className="font-medium">
                      <div>{String(member.member_name ?? "-")}</div>
                      <div className="text-muted-foreground text-xs">{String(member.member_code ?? "")}</div>
                    </TableCell>
                    <TableCell>
                      <div className="whitespace-nowrap">{String(member.member_phone ?? "-")}</div>
                      <div className="text-muted-foreground text-xs">
                        {member.type === "addon" ? t("extraService") : t("mainSubscription")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{String(member.plan_name ?? "-")}</div>
                      <div className="text-muted-foreground text-xs">{String(member.plan_category ?? "")}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div>{String(member.start_date ?? "-")}</div>
                      <div className="text-muted-foreground text-xs">→ {String(member.end_date ?? "-")}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      <div>{currency(member.paid_amount)}</div>
                      <div className="text-muted-foreground text-xs">
                        {member.payment_source === "parent_package"
                          ? t("paidThroughPackage", {
                              amount: currency(member.payment_price),
                              plan: String(member.payment_plan_name ?? "-"),
                            })
                          : t("packagePrice", { amount: currency(member.payment_price ?? member.price_paid) })}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-28 text-xs">{paymentHistory}</TableCell>
                    <TableCell className="min-w-40">
                      <div className="font-medium">
                        {t("visitSummary", {
                          days: Number(member.attended_days_this_month ?? 0),
                          visits: Number(member.total_visits_this_month ?? 0),
                        })}
                      </div>
                      <div className="mt-1 space-y-0.5 text-muted-foreground text-xs">
                        {attendanceDates.length > 0
                          ? attendanceDates.map((attendance) => (
                              <div key={String(attendance.date)}>
                                {String(attendance.date)} ·{" "}
                                {t("visitsCount", { count: Number(attendance.visits ?? 0) })}
                              </div>
                            ))
                          : t("noAttendance")}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{sessionsLabel}</TableCell>
                    <TableCell>
                      <Badge variant={SUBSCRIPTION_STATUS_VARIANTS[String(member.status)] ?? "secondary"}>
                        {String(member.status ?? "-")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {members.length === 0 ? <EmptyTableRow columns={9} label={t("empty")} /> : null}
              <TablePagination columns={9} pagination={pagination} />
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
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

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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
// 4. Member Subscriptions View
// ---------------------------------------------------------------------------
const SUBSCRIPTION_STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  frozen: "secondary",
  expired: "destructive",
  stopped: "outline",
};

const BILLING_STATUS_LABELS: Record<string, string> = {
  paid: "Fully paid",
  pending: "Balance due",
  overdue: "Overdue",
  stopped: "Closed",
  refunded: "Refunded",
  partial_refund: "Partly refunded",
};

function MemberSubscriptionsView({
  data,
  statusFilter,
  searchFilter,
  onStatusChange,
  onSearchChange,
  onExport,
  isPending,
}: {
  data: Record<string, unknown>;
  statusFilter: string;
  searchFilter: string;
  onStatusChange: (val: string) => void;
  onSearchChange: (val: string) => void;
  onExport: (filename: string, headers: string[], rows: (string | number)[][]) => void;
  isPending: boolean;
}) {
  const totals = asRecord(data.totals);
  const members = asRows(data.members);
  const memberPagination = useTablePagination(members);

  function handleExport() {
    const headers = [
      "Member",
      "Phone",
      "Plan",
      "Status",
      "Start",
      "End",
      "Days left",
      "Sessions used",
      "Sessions total",
      "Sessions left",
      "Visits",
      "Visit days",
      "Last visit",
      "Package price",
      "Paid",
      "Balance",
      "Refunded",
      "Payments",
      "Billing",
      "Coach",
      "Sold by",
      "Add-ons",
      "Total subscriptions",
    ];
    const rows = members.map((row) => {
      const latest = asRecord(row.latest);

      return [
        String(row.member_name ?? ""),
        String(row.member_phone ?? ""),
        String(latest.plan_name ?? ""),
        String(latest.status ?? ""),
        String(latest.start_date ?? ""),
        String(latest.end_date ?? ""),
        String(latest.days_left ?? ""),
        String(latest.sessions_used ?? ""),
        String(latest.sessions_total ?? "Unlimited"),
        String(latest.sessions_remaining ?? "Unlimited"),
        String(latest.visits_count ?? 0),
        String(latest.visit_days_count ?? 0),
        formatDateTime(latest.last_visit_at),
        String(latest.package_price ?? "0.00"),
        String(latest.package_paid_total ?? "0.00"),
        String(latest.package_balance ?? "0.00"),
        String(latest.refund_total ?? "0.00"),
        String(latest.payments_count ?? 0),
        String(latest.billing_status ?? ""),
        String(latest.coach_name ?? ""),
        String(latest.sold_by ?? ""),
        String(latest.addons_count ?? 0),
        String(row.subscriptions_count ?? 1),
      ];
    });
    onExport("member_subscriptions_report", headers, rows);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <ReportMetric
          title="Members"
          value={String(totals.members_count ?? 0)}
          detail={`${String(totals.active_count ?? 0)} active · ${String(totals.expired_count ?? 0)} expired`}
        />
        <ReportMetric
          title="Collected"
          value={currency(totals.total_collected)}
          detail="Latest subscription + add-ons"
        />
        <ReportMetric
          title="Outstanding"
          value={currency(totals.total_outstanding)}
          detail="Balance still due"
          destructive={Number(totals.total_outstanding ?? 0) > 0}
        />
        <ReportMetric
          title="Check-ins"
          value={String(totals.total_visits ?? 0)}
          detail={`${String(totals.frozen_count ?? 0)} frozen · ${String(totals.stopped_count ?? 0)} stopped`}
        />
        <ReportMetric
          title="Avg. sessions used"
          value={totals.avg_attendance_rate === null ? "—" : `${String(totals.avg_attendance_rate ?? 0)}%`}
          detail="Session-limited plans only"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Members & latest subscription</CardTitle>
            <CardDescription>
              Attendance, payments, plan window and staff for each member&apos;s most recent subscription. Open the
              history to see every previous subscription.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64 lg:w-80">
              <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, phone or QR code..."
                defaultValue={searchFilter}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-9 ps-8 text-xs"
              />
            </div>
            <FormSelect
              name="status"
              defaultValue={statusFilter}
              placeholder="All Statuses"
              options={[
                { label: "All Statuses", value: "" },
                { label: "Active", value: "active" },
                { label: "Frozen", value: "frozen" },
                { label: "Expired", value: "expired" },
                { label: "Stopped", value: "stopped" },
              ]}
              onValueChange={(val) => onStatusChange(val)}
            />
            <Button size="sm" variant="outline" onClick={handleExport} disabled={isPending}>
              <Download className="me-1.5 size-4" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Check-ins</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Coach / sold by</TableHead>
                <TableHead className="text-end">History</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberPagination.pageRows.map((row) => {
                const latest = asRecord(row.latest);
                const addonsCount = Number(latest.addons_count ?? 0);

                return (
                  <TableRow key={String(row.member_id)}>
                    <TableCell className="font-medium">
                      <div>{String(row.member_name ?? "-")}</div>
                      <div className="text-muted-foreground text-xs">{String(row.member_phone ?? "")}</div>
                    </TableCell>
                    <TableCell>
                      <div>{String(latest.plan_name ?? "-")}</div>
                      <div className="text-muted-foreground text-xs">
                        {String(latest.plan_category ?? latest.plan_type ?? "")}
                        {addonsCount > 0 ? ` · +${addonsCount} add-on${addonsCount > 1 ? "s" : ""}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div>
                        {String(latest.start_date ?? "-")} → {String(latest.end_date ?? "-")}
                      </div>
                      <div className="text-muted-foreground text-xs">{formatDaysLeft(latest.days_left)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={SUBSCRIPTION_STATUS_VARIANTS[String(latest.status)] ?? "secondary"}>
                        {String(latest.status ?? "-")}
                      </Badge>
                      {Number(latest.freeze_days_used ?? 0) > 0 ? (
                        <div className="mt-1 text-muted-foreground text-xs">
                          {String(latest.freeze_days_used)} freeze days
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatSessions(latest)}</TableCell>
                    <TableCell>
                      <div>{String(latest.visits_count ?? 0)} visits</div>
                      <div className="text-muted-foreground text-xs">
                        {latest.last_visit_at ? `last ${formatDateTime(latest.last_visit_at)}` : "never checked in"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-emerald-600 dark:text-emerald-400">
                        {currency(latest.package_paid_total)}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        of {currency(latest.package_price)} · {String(latest.payments_count ?? 0)} payment
                        {Number(latest.payments_count ?? 0) === 1 ? "" : "s"}
                      </div>
                    </TableCell>
                    <TableCell
                      className={Number(latest.package_balance ?? 0) > 0 ? "font-semibold text-rose-600" : undefined}
                    >
                      {currency(latest.package_balance)}
                      {Number(latest.refund_total ?? 0) > 0 ? (
                        <div className="text-muted-foreground text-xs">{currency(latest.refund_total)} refunded</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={latest.billing_status === "overdue" ? "destructive" : "outline"}>
                        {BILLING_STATUS_LABELS[String(latest.billing_status)] ?? String(latest.billing_status ?? "-")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>{String(latest.coach_name ?? "-")}</div>
                      <div className="text-muted-foreground text-xs">{String(latest.sold_by ?? "")}</div>
                    </TableCell>
                    <TableCell className="text-end">
                      <MemberSubscriptionHistoryDialog member={row} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {members.length === 0 ? (
                <EmptyTableRow columns={11} label="No members with subscriptions match these filters." />
              ) : null}
              <TablePagination columns={11} pagination={memberPagination} />
            </TableBody>
          </Table>
          {totals.truncated ? (
            <p className="pt-3 text-muted-foreground text-xs">
              Showing the first {String(totals.members_count ?? 0)} of {String(totals.matched_count ?? 0)} matching
              members. Narrow the date range or search to see the rest.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function MemberSubscriptionHistoryDialog({ member }: { member: Record<string, unknown> }) {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isLoading, startTransition] = useTransition();
  const [isDetailLoading, startDetailTransition] = useTransition();
  const history = asRows(payload?.history);
  const historyTotals = asRecord(payload?.totals);
  const memberId = Number(member.member_id);
  const memberName = String(member.member_name ?? "Member");
  const subscriptionsCount = Number(member.subscriptions_count ?? 1);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen || payload || isLoading) return;

    setError(null);
    startTransition(async () => {
      try {
        // The latest subscription's log ships with the history, so the panel
        // renders immediately on the default selection.
        const data = await getMemberSubscriptionHistory(memberId);
        const preloaded = asRecord(data.detail);

        setPayload(data);
        setDetail(preloaded);
        setSelectedId(Number(asRecord(preloaded.subscription).id) || null);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Could not load subscription history.");
      }
    });
  }

  function handleSelect(subscriptionId: number) {
    if (subscriptionId === selectedId || isDetailLoading) return;

    setSelectedId(subscriptionId);
    setDetailError(null);
    startDetailTransition(async () => {
      try {
        setDetail(asRecord((await getSubscriptionDetail(subscriptionId)).detail));
      } catch (requestError) {
        setDetail(null);
        setDetailError(
          requestError instanceof Error ? requestError.message : "Could not load this subscription's log.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <History />
        {subscriptionsCount > 1 ? `All ${subscriptionsCount}` : "History"}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-[calc(100vw-3rem)] xl:max-w-[calc(100vw-4rem)]">
        <DialogHeader>
          <DialogTitle>{memberName}&apos;s subscriptions</DialogTitle>
          <DialogDescription>
            Pick a plan on the left to see everything recorded against it — every check-in with its exact times, the
            payment ledger, freezes and refunds. The latest subscription is selected by default.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? <p className="text-muted-foreground text-sm">Loading subscription history…</p> : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {!isLoading && !error ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ReportMetric
                title="Subscriptions"
                value={String(historyTotals.subscriptions_count ?? 0)}
                detail="Lifetime memberships"
              />
              <ReportMetric
                title="Lifetime paid"
                value={currency(historyTotals.lifetime_paid)}
                detail="Across every subscription"
              />
              <ReportMetric
                title="Lifetime balance"
                value={currency(historyTotals.lifetime_balance)}
                detail="Still owed"
                destructive={Number(historyTotals.lifetime_balance ?? 0) > 0}
              />
              <ReportMetric
                title="Lifetime check-ins"
                value={String(historyTotals.lifetime_visits ?? 0)}
                detail="All recorded visits"
              />
            </div>

            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="shrink-0 space-y-2 lg:w-72">
                <p className="font-semibold text-muted-foreground text-xs uppercase">
                  Subscribed plans ({history.length})
                </p>
                <div className="max-h-[52dvh] space-y-2 overflow-y-auto pe-1">
                  {history.map((subscription) => (
                    <SubscriptionPlanCard
                      key={String(subscription.id)}
                      subscription={subscription}
                      isSelected={Number(subscription.id) === selectedId}
                      onSelect={handleSelect}
                    />
                  ))}
                  {history.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No subscriptions recorded for this member.</p>
                  ) : null}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                {isDetailLoading ? <p className="text-muted-foreground text-sm">Loading subscription log…</p> : null}
                {detailError ? <p className="text-destructive text-sm">{detailError}</p> : null}
                {!isDetailLoading && !detailError && detail ? <SubscriptionDetailPanel detail={detail} /> : null}
                {!isDetailLoading && !detailError && !detail ? (
                  <p className="text-muted-foreground text-sm">Select a plan to see its full log.</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionPlanCard({
  subscription,
  isSelected,
  onSelect,
}: {
  subscription: Record<string, unknown>;
  isSelected: boolean;
  onSelect: (subscriptionId: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(Number(subscription.id))}
      className={`w-full rounded-lg border p-3 text-start transition-colors ${
        isSelected ? "border-primary bg-primary/10" : "hover:bg-muted/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm">{String(subscription.plan_name ?? "-")}</span>
        <Badge variant={SUBSCRIPTION_STATUS_VARIANTS[String(subscription.status)] ?? "secondary"}>
          {String(subscription.status ?? "-")}
        </Badge>
      </div>
      <div className="mt-1 text-muted-foreground text-xs">
        {String(subscription.start_date ?? "-")} → {String(subscription.end_date ?? "-")}
      </div>
      <div className="mt-1 text-muted-foreground text-xs">
        {String(subscription.visits_count ?? 0)} check-ins · {currency(subscription.package_paid_total)} paid
        {Number(subscription.package_balance ?? 0) > 0 ? ` · ${currency(subscription.package_balance)} due` : ""}
      </div>
    </button>
  );
}

function SubscriptionDetailPanel({ detail }: { detail: Record<string, unknown> }) {
  const subscription = asRecord(detail.subscription);
  const visits = asRows(detail.visits);
  const payments = asRows(detail.payments);
  const freezes = asRows(detail.freezes);
  const refunds = asRows(detail.refunds);
  const addons = asRows(subscription.addons);
  const visitPagination = useTablePagination(visits);
  const paymentPagination = useTablePagination(payments);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric
          title={String(subscription.plan_name ?? "Plan")}
          value={String(subscription.status ?? "-")}
          detail={`${String(subscription.start_date ?? "-")} → ${String(subscription.end_date ?? "-")} · ${formatDaysLeft(subscription.days_left)}`}
        />
        <ReportMetric
          title="Sessions"
          value={
            subscription.sessions_total === null || subscription.sessions_total === undefined
              ? "Unlimited"
              : `${String(subscription.sessions_used ?? 0)} / ${String(subscription.sessions_total)}`
          }
          detail={
            subscription.sessions_total === null || subscription.sessions_total === undefined
              ? "No session cap on this plan"
              : `${String(subscription.sessions_remaining ?? 0)} left · ${String(subscription.attendance_rate ?? 0)}% used`
          }
        />
        <ReportMetric
          title="Check-ins"
          value={String(subscription.visits_count ?? 0)}
          detail={`${String(subscription.visit_days_count ?? 0)} distinct days${
            subscription.visits_per_week ? ` · ${String(subscription.visits_per_week)}/week` : ""
          }`}
        />
        <ReportMetric
          title="Balance"
          value={currency(subscription.package_balance)}
          detail={`${currency(subscription.package_paid_total)} paid of ${currency(subscription.package_price)}`}
          destructive={Number(subscription.package_balance ?? 0) > 0}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Check-in log</CardTitle>
          <CardDescription>
            Every visit on this subscription with its exact in and out times, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Checked in</TableHead>
                <TableHead>Checked out</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Add-on session</TableHead>
                <TableHead>Recorded by</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitPagination.pageRows.map((visit) => (
                <TableRow key={String(visit.id)}>
                  <TableCell className="whitespace-nowrap font-medium">{formatDateTime(visit.check_in_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div>{formatTime(visit.check_in_at)}</div>
                    {visit.check_in_location_status === "outside" ? (
                      <div className="text-amber-600 text-xs dark:text-amber-400">outside geofence</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {visit.is_open ? (
                      <span className="text-muted-foreground text-xs">still inside</span>
                    ) : (
                      <>
                        <div>{formatTime(visit.check_out_at)}</div>
                        {visit.check_out_location_status === "outside" ? (
                          <div className="text-amber-600 text-xs dark:text-amber-400">outside geofence</div>
                        ) : null}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDuration(visit.duration_minutes)}</TableCell>
                  <TableCell>
                    <Badge variant={visit.counts_as_attendance === false ? "destructive" : "outline"}>
                      {String(visit.status ?? "-")}
                    </Badge>
                    {visit.alert_reason ? (
                      <div className="mt-1 text-muted-foreground text-xs">{String(visit.alert_reason)}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{String(visit.scan_method ?? "—")}</TableCell>
                  <TableCell className="text-xs">{String(visit.addon_plan_name ?? "—")}</TableCell>
                  <TableCell className="text-xs">{String(visit.recorded_by ?? "—")}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground text-xs">
                    {String(visit.notes ?? "")}
                  </TableCell>
                </TableRow>
              ))}
              {visits.length === 0 ? (
                <EmptyTableRow columns={9} label="No check-ins recorded on this subscription." />
              ) : null}
              <TablePagination columns={9} pagination={visitPagination} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payment ledger</CardTitle>
          <CardDescription>Subscription and add-on payments, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>For</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Recorded by</TableHead>
                <TableHead>Shift</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentPagination.pageRows.map((payment) => (
                <TableRow key={String(payment.id)}>
                  <TableCell className="whitespace-nowrap">
                    {payment.paid_at ? formatDateTimeFull(payment.paid_at) : "not collected"}
                  </TableCell>
                  <TableCell>
                    <div>{String(payment.target ?? "-")}</div>
                    {payment.is_addon ? <div className="text-muted-foreground text-xs">add-on</div> : null}
                  </TableCell>
                  <TableCell className="font-medium">{currency(payment.amount)}</TableCell>
                  <TableCell className="text-xs">{String(payment.method ?? "—")}</TableCell>
                  <TableCell>
                    <Badge variant={payment.is_overdue ? "destructive" : "outline"}>
                      {String(payment.status ?? "-")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{String(payment.due_date ?? "—")}</TableCell>
                  <TableCell className="text-xs">{String(payment.recorded_by ?? "—")}</TableCell>
                  <TableCell className="text-xs">
                    {payment.shift_session_id ? `#${String(payment.shift_session_id)}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 ? (
                <EmptyTableRow columns={8} label="No payments recorded on this subscription." />
              ) : null}
              <TablePagination columns={8} pagination={paymentPagination} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {addons.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Add-on plans</CardTitle>
            <CardDescription>Extra plans bought alongside this subscription.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Check-ins</TableHead>
                  <TableHead>Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addons.map((addon) => (
                  <TableRow key={String(addon.id)}>
                    <TableCell className="font-medium">{String(addon.plan_name ?? "-")}</TableCell>
                    <TableCell>{String(addon.coach_name ?? "—")}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {String(addon.start_date ?? "-")} → {String(addon.end_date ?? "-")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={SUBSCRIPTION_STATUS_VARIANTS[String(addon.status)] ?? "secondary"}>
                        {String(addon.status ?? "-")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {addon.sessions_total === null || addon.sessions_total === undefined
                        ? "Unlimited"
                        : `${String(addon.sessions_remaining ?? 0)} of ${String(addon.sessions_total)} left`}
                    </TableCell>
                    <TableCell>{String(addon.visits_count ?? 0)}</TableCell>
                    <TableCell>
                      {currency(addon.paid_total)}
                      <div className="text-muted-foreground text-xs">of {currency(addon.price_paid)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {freezes.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Freezes</CardTitle>
            <CardDescription>Every pause applied to this subscription.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Resumed</TableHead>
                  <TableHead>Days left at freeze</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {freezes.map((freeze) => (
                  <TableRow key={String(freeze.id)}>
                    <TableCell>{String(freeze.freeze_start ?? "-")}</TableCell>
                    <TableCell>{String(freeze.freeze_end ?? "-")}</TableCell>
                    <TableCell>{String(freeze.days ?? 0)}</TableCell>
                    <TableCell>{String(freeze.resumed_on ?? "still frozen")}</TableCell>
                    <TableCell>{String(freeze.remaining_days_at_freeze ?? "—")}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{String(freeze.reason ?? "")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {refunds.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Refunds</CardTitle>
            <CardDescription>Money returned against this subscription.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refunds.map((refund) => (
                  <TableRow key={String(refund.id)}>
                    <TableCell>{formatDateTimeFull(refund.refunded_at)}</TableCell>
                    <TableCell className="font-medium">{currency(refund.amount)}</TableCell>
                    <TableCell className="text-xs">{String(refund.method ?? "—")}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{String(refund.reason ?? "")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function formatSessions(subscription: Record<string, unknown>) {
  if (subscription.sessions_total === null || subscription.sessions_total === undefined) {
    return <span className="text-muted-foreground text-xs">Unlimited</span>;
  }

  return (
    <div>
      <div>
        {String(subscription.sessions_used ?? 0)} / {String(subscription.sessions_total)} used
      </div>
      <div className="text-muted-foreground text-xs">
        {String(subscription.sessions_remaining ?? 0)} left
        {subscription.attendance_rate === null || subscription.attendance_rate === undefined
          ? ""
          : ` · ${String(subscription.attendance_rate)}%`}
      </div>
    </div>
  );
}

function formatDaysLeft(daysLeft: unknown) {
  if (daysLeft === null || daysLeft === undefined) return "ended";

  const days = Number(daysLeft);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "ends today";

  return `${days} days left`;
}

function formatDateTime(value: unknown) {
  return formatReportDate(value, "dd MMM yyyy");
}

function formatTime(value: unknown) {
  return formatReportDate(value, "HH:mm") || "—";
}

function formatDateTimeFull(value: unknown) {
  return formatReportDate(value, "dd MMM yyyy · HH:mm") || "—";
}

function formatReportDate(value: unknown, pattern: string) {
  if (!value) return "";

  const date = parseISO(String(value));
  return Number.isNaN(date.getTime()) ? "" : format(date, pattern);
}

function formatDuration(minutes: unknown) {
  if (minutes === null || minutes === undefined) return "—";

  const total = Number(minutes);
  if (!Number.isFinite(total) || total < 0) return "—";
  if (total < 60) return `${total}m`;

  const remainder = total % 60;
  return remainder === 0 ? `${Math.floor(total / 60)}h` : `${Math.floor(total / 60)}h ${remainder}m`;
}

// ---------------------------------------------------------------------------
// 5. Income vs Outcome View
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
