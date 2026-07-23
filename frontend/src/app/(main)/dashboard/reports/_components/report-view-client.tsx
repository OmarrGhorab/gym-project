"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Banknote, BarChart3, Calendar, Download, FileSpreadsheet, Filter, Package, Search, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/form-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

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
      <Tabs value={activeTab} onValueChange={(val) => updateParams({ type: val })} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1 p-1">
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
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 me-2">
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
              <div className="flex items-center gap-1 text-xs">
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => updateParams({ from: e.target.value })}
                  className="h-8 w-36 text-xs"
                />
                <span>to</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => updateParams({ to: e.target.value })}
                  className="h-8 w-36 text-xs"
                />
              </div>
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
          searchFilter={searchFilter}
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
            <CardTitle className="text-lg text-amber-700 dark:text-amber-300 flex items-center gap-2">
              Members Finishing Plan or Low Sessions
            </CardTitle>
            <CardDescription>Members whose plan ends within 7 days or have ≤ 3 remaining sessions</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleExportEndingSoon}>
            <Download className="size-4 me-1.5" /> Export Ending List
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
              {endingSoonMembers.map((sub) => {
                const daysLeft = sub.days_left !== null && sub.days_left !== undefined ? Number(sub.days_left) : null;
                const reason = String(sub.attention_reason ?? "ending_soon");

                const isSessionsFinished =
                  sub.sessions_total !== null && Number(sub.sessions_total) > 0 && Number(sub.sessions_remaining) <= 0;
                const isMonthFinished = daysLeft !== null && daysLeft <= 0;

                const finishedSessionsButNotMonth = isSessionsFinished && !isMonthFinished;
                const finishedMonthButNotSessions = isMonthFinished && !isSessionsFinished;
                const finishedBoth = isMonthFinished && isSessionsFinished;

                const showWhatsApp = finishedSessionsButNotMonth || finishedMonthButNotSessions || finishedBoth;

                let whatsappUrl = "";
                if (showWhatsApp && sub.member_phone) {
                  let cleanPhone = String(sub.member_phone).replace(/\D/g, "");
                  if (cleanPhone.startsWith("01") && cleanPhone.length === 11) {
                    cleanPhone = "2" + cleanPhone;
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
                  whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
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
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
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
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold"
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
                            ? "bg-rose-500/10 text-rose-600 border-rose-500/20 font-semibold"
                            : reason === "low_sessions"
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : "bg-blue-500/10 text-blue-600 border-blue-500/20"
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
                      {whatsappUrl ? (
                        <Button
                          size="xs"
                          variant="outline"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 h-7 px-2.5 font-medium inline-flex items-center gap-1.5"
                          render={<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" />}
                        >
                          <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          WhatsApp
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs font-normal">-</span>
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
              {plansSummary.map((plan) => (
                <TableRow key={String(plan.id)}>
                  <TableCell className="font-medium">{String(plan.name)}</TableCell>
                  <TableCell>EGP {String(plan.price)}</TableCell>
                  <TableCell>{String(plan.duration_days)} days</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      {String(plan.active_members)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                      {String(plan.expiring_soon)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20">
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
              <Download className="size-4 me-1.5" /> Export CSV
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
              {subscriptions.map((sub) => {
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
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : daysLeft <= 7
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
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
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold"
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
function ProductsFinanceView({
  data,
  categoryFilter,
  searchFilter,
  onCategoryChange,
  onSearchChange,
  onExport,
  isPending,
}: {
  data: Record<string, unknown>;
  categoryFilter: string;
  searchFilter: string;
  onCategoryChange: (val: string) => void;
  onSearchChange: (val: string) => void;
  onExport: (filename: string, headers: string[], rows: (string | number)[][]) => void;
  isPending: boolean;
}) {
  const totals = (data.totals as Record<string, unknown>) ?? {};
  const productsSummary = (data.products_summary as Record<string, unknown>[]) ?? [];
  const transactions = (data.transactions as Record<string, unknown>[]) ?? [];

  function handleExport() {
    const headers = ["Product Name", "Category", "Stock", "Units Sold", "Price", "Revenue", "Status"];
    const rows = productsSummary.map((p) => [
      String(p.name ?? ""),
      String(p.category ?? ""),
      String(p.stock_quantity ?? 0),
      String(p.units_sold_period ?? 0),
      String(p.price ?? "0.00"),
      String(p.revenue_period ?? "0.00"),
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
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search product..."
                defaultValue={searchFilter}
                onChange={(e) => onSearchChange(e.target.value)}
                className="ps-8 h-9 text-xs"
              />
            </div>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="size-4 me-1.5" /> Export CSV
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
                <TableHead>Current Stock</TableHead>
                <TableHead>Units Sold (Period)</TableHead>
                <TableHead className="text-end">Revenue (Period)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsSummary.map((prod) => (
                <TableRow key={String(prod.id)}>
                  <TableCell className="font-medium">{String(prod.name)}</TableCell>
                  <TableCell>{String(prod.category)}</TableCell>
                  <TableCell>EGP {String(prod.price)}</TableCell>
                  <TableCell>{String(prod.stock_quantity)}</TableCell>
                  <TableCell className="font-semibold">{String(prod.units_sold_period)}</TableCell>
                  <TableCell className="text-end font-semibold text-emerald-600 dark:text-emerald-400">
                    EGP {String(prod.revenue_period)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        prod.status === "in_stock"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : prod.status === "low_stock"
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                      }
                    >
                      {String(prod.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {productsSummary.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    No products found matching criteria.
                  </TableCell>
                </TableRow>
              )}
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
              {transactions.map((tx) => (
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
              <Download className="size-4 me-1.5" /> Export CSV
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
              {shifts.map((s) => (
                <TableRow key={String(s.id)}>
                  <TableCell className="font-medium">#{String(s.id)}</TableCell>
                  <TableCell>{String(s.opened_by)}</TableCell>
                  <TableCell>{String(s.closed_by)}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "accepted" ? "default" : "secondary"}>{String(s.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-emerald-600 font-medium">
                    EGP {String(s.subscription_sales_amount)}
                  </TableCell>
                  <TableCell className="text-emerald-600 font-medium">EGP {String(s.pos_sales_amount)}</TableCell>
                  <TableCell className="text-end font-bold">EGP {String(s.total_revenue)}</TableCell>
                  <TableCell>EGP {String(s.expected_cash)}</TableCell>
                  <TableCell>{s.counted_cash ? `EGP ${s.counted_cash}` : "N/A"}</TableCell>
                  <TableCell className={Number(s.discrepancy) < 0 ? "text-rose-600 font-semibold" : ""}>
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
            <Download className="size-4 me-1.5" /> Export CSV
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
              {timeline.map((row) => (
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
