import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BarChart3, ReceiptText, TrendingDown, TrendingUp } from "lucide-react";
import { EmployeePerformanceReportTable } from "@/components/reports/employee-performance-report-table";
import { FinancialReportTable } from "@/components/reports/financial-report-table";
import { ReportsFilterBar } from "@/components/reports/reports-filter-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getEmployeePerformance,
  getFinancialReport,
  type EmployeePerformance,
  type FinancialReport,
} from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ReportsPage" });
  return { title: t("metadataTitle"), description: t("metadataDescription") };
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string; group_by?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ReportsPage");
  const isArabic = locale === "ar";
  const resolvedSearchParams = await searchParams;
  const from = normalizeDate(resolvedSearchParams.from) ?? monthStart();
  const to = normalizeDate(resolvedSearchParams.to) ?? today();
  const groupBy = resolvedSearchParams.group_by === "month" ? "month" : "day";

  let financial: FinancialReport = {
    data: [],
    meta: {
      from,
      to,
      group_by: groupBy,
      totals: { revenue: "0.00", expenses: "0.00", net_profit: "0.00" },
    },
  };
  let employees: EmployeePerformance[] = [];
  let fetchError: string | null = null;

  try {
    [financial, employees] = await Promise.all([
      getFinancialReport(from, to, groupBy),
      getEmployeePerformance({ from, to }),
    ]);
  } catch {
    fetchError = t("fetchError");
  }

  const stats = [
    { label: t("statRevenue"), value: formatCurrency(financial.meta.totals.revenue, locale), hint: t("statRevenueHint"), icon: TrendingUp, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    { label: t("statExpenses"), value: formatCurrency(financial.meta.totals.expenses, locale), hint: t("statExpensesHint"), icon: TrendingDown, className: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
    { label: t("statNet"), value: formatCurrency(financial.meta.totals.net_profit, locale), hint: t("statNetHint"), icon: BarChart3, className: "bg-primary/15 text-primary" },
    { label: t("statEmployees"), value: employees.length, hint: t("statEmployeesHint"), icon: ReceiptText, className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className={cn(isArabic && "text-right")}>
        <h1 className="text-3xl font-black tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">{t("description")}</p>
      </header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-lg shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-bold text-card-foreground">{stat.label}</CardTitle>
              <span className={cn("grid size-8 place-items-center rounded-lg", stat.className)}><stat.icon className="size-4" /></span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black tracking-tight text-foreground tabular-nums">{typeof stat.value === "number" ? stat.value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US") : stat.value}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <Card className="border shadow-xs"><CardContent className="p-4"><ReportsFilterBar /></CardContent></Card>
      {fetchError && <div className="rounded-md bg-destructive/10 p-4 text-sm font-medium text-destructive">{fetchError}</div>}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden border shadow-xs">
          <div className="border-b bg-muted/15 px-4 py-4">
            <h2 className={cn("text-base font-black text-foreground", isArabic && "text-right")}>{t("financialTitle")}</h2>
          </div>
          <FinancialReportTable rows={financial.data} />
        </Card>
        <Card className="overflow-hidden border shadow-xs">
          <div className="border-b bg-muted/15 px-4 py-4">
            <h2 className={cn("text-base font-black text-foreground", isArabic && "text-right")}>{t("employeesTitle")}</h2>
          </div>
          <EmployeePerformanceReportTable rows={employees} />
        </Card>
      </div>
    </div>
  );
}

function normalizeDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value: string | number, locale: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });
}
