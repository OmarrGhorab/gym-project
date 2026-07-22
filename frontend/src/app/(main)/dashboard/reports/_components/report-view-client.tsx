"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const totals = (data.totals as Record<string, unknown>) ?? {};
  const plansSummary = (data.plans_summary as Record<string, unknown>[]) ?? [];
  const subscriptions = (data.subscriptions as Record<string, unknown>[]) ?? [];

  function handleExport() {
    const headers = ["Member Name", "Plan Name", "Start Date", "End Date", "Status", "Price Paid", "Sold By"];
    const rows = subscriptions.map((s) => [
      String(s.member_name ?? ""),
      String(s.plan_name ?? ""),
      String(s.start_date ?? ""),
      String(s.end_date ?? ""),
      String(s.status ?? ""),
      String(s.price_paid ?? "0.00"),
      String(s.sold_by ?? ""),
    ]);
    onExport("classes_plans_report", headers, rows);
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
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
            <CardDescription>Expiring Soon (7 Days)</CardDescription>
            <CardTitle className="text-2xl text-amber-600 dark:text-amber-400">
              {String(totals.expiring_soon ?? 0)}
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
                <TableHead>Expiring Soon</TableHead>
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
            <CardDescription>Individual subscription breakdown</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <FormSelect
              name="status"
              defaultValue={statusFilter}
              placeholder="All Statuses"
              options={[
                { label: "All Statuses", value: "" },
                { label: "Active", value: "active" },
                { label: "Expiring Soon", value: "expiring_soon" },
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
                <TableHead>Status</TableHead>
                <TableHead>Price Paid</TableHead>
                <TableHead>Sold By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={String(sub.id)}>
                  <TableCell className="font-medium">{String(sub.member_name)}</TableCell>
                  <TableCell>{String(sub.plan_name)}</TableCell>
                  <TableCell>{String(sub.start_date ?? "N/A")}</TableCell>
                  <TableCell>{String(sub.end_date ?? "N/A")}</TableCell>
                  <TableCell>
                    <Badge variant={sub.status === "active" ? "default" : "secondary"}>{String(sub.status)}</Badge>
                  </TableCell>
                  <TableCell>EGP {String(sub.price_paid)}</TableCell>
                  <TableCell>{String(sub.sold_by)}</TableCell>
                </TableRow>
              ))}
              {subscriptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
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
