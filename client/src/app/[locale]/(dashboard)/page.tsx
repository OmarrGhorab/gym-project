import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  AlertCircle,
  CalendarDays,
  CreditCard,
  Package,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardDatePicker } from "@/components/dashboard/dashboard-date-picker";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { cn } from "@/lib/utils";
import {
  getDashboardSummary,
  getDashboardExpiringSoon,
  getDailySales,
  getLowStockProducts,
  getFinancialReport,
} from "@/lib/api/dashboard";
import { format, isValid, parseISO, subDays } from "date-fns";
import { arEG, enUS } from "date-fns/locale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata.Dashboard" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function DashboardOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { locale } = await params;
  const { date: dateParam } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Dashboard");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const dateFnsLocale = isArabic ? arEG : enUS;

  const parsedDate = dateParam ? parseISO(dateParam) : new Date();
  const selectedDate = isValid(parsedDate) ? parsedDate : new Date();

  const dateLabel = selectedDate.toLocaleDateString(dateLocale, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const from = subDays(selectedDate, 29);
  const fromStr = format(from, "yyyy-MM-dd");
  const toStr = format(selectedDate, "yyyy-MM-dd");

  const [
    summaryResult,
    expiringResult,
    dailySalesResult,
    lowStockResult,
    financialResult,
  ] = await Promise.allSettled([
    getDashboardSummary(),
    getDashboardExpiringSoon(1),
    getDailySales(toStr),
    getLowStockProducts(5),
    getFinancialReport(fromStr, toStr, "day"),
  ]);

  const summary =
    summaryResult.status === "fulfilled" ? summaryResult.value : null;
  const expiring =
    expiringResult.status === "fulfilled" ? expiringResult.value : null;
  const dailySales =
    dailySalesResult.status === "fulfilled" ? dailySalesResult.value : null;
  const lowStock =
    lowStockResult.status === "fulfilled" ? lowStockResult.value : null;
  const financial =
    financialResult.status === "fulfilled" ? financialResult.value : null;

  const errors: string[] = [];
  if (summaryResult.status === "rejected") errors.push(t("errors.summary"));
  if (expiringResult.status === "rejected") errors.push(t("errors.expiring"));
  if (dailySalesResult.status === "rejected") errors.push(t("errors.sales"));
  if (lowStockResult.status === "rejected") errors.push(t("errors.stock"));
  if (financialResult.status === "rejected") errors.push(t("errors.revenue"));

  const stats = [
    {
      label: t("stats.todayRevenue"),
      value: formatCurrency(dailySales?.total_revenue ?? 0, locale),
      hint: format(selectedDate, "MMM d", { locale: dateFnsLocale }),
      change: "",
      positive: true,
      icon: TrendingUp,
      sparkline: SparkLine,
    },
    {
      label: t("stats.todaySales"),
      value: String(dailySales?.sales.length ?? 0),
      hint: format(selectedDate, "MMM d", { locale: dateFnsLocale }),
      change: "",
      positive: true,
      icon: Package,
      sparkline: SparkBars,
    },
    {
      label: t("stats.activeSubscriptions"),
      value: String(summary?.active_subscriptions ?? 0),
      hint: summary?.expiring_soon
        ? `${summary.expiring_soon} ${t("stats.expiringThisWeek")}`
        : "",
      change: "",
      positive: true,
      icon: CreditCard,
      sparkline: SparkLine,
    },
    {
      label: t("stats.expiringThisWeek"),
      value: String(summary?.expiring_soon ?? 0),
      hint: t("panels.expiringSoonTitle"),
      change: "",
      positive: true,
      icon: CalendarDays,
      sparkline: SparkBars,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <span>{dateLabel}</span>
            <span className="text-muted-foreground/50">/</span>
            <span>{t("eyebrow")}</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <DashboardDatePicker date={toStr} locale={locale} />
      </header>

      {errors.length > 0 && (
        <Card className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                Some dashboard data could not be loaded
              </p>
              <ul className="list-inside list-disc text-xs opacity-90">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-lg shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-bold text-card-foreground">
                {stat.label}
              </CardTitle>
              <span className="grid size-8 place-items-center rounded-lg bg-primary/20 text-primary-foreground dark:text-primary">
                <stat.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-end justify-between gap-3">
                <p className="text-3xl font-black tracking-tight text-foreground">
                  {stat.value}
                </p>
                <stat.sparkline className="h-9 w-16 text-muted-foreground" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {stat.hint}
                {stat.change && (
                  <span
                    className={cn(
                      "ms-2 font-bold",
                      stat.positive ? "text-emerald-600" : "text-rose-600"
                    )}
                  >
                    {stat.change}
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <Card className="rounded-lg shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold">
              {t("charts.revenueTitle")}
            </CardTitle>
            <div className="flex rounded-md bg-muted p-1 text-xs font-bold text-muted-foreground">
              {["30d"].map((item) => (
                <span
                  key={item}
                  className="rounded bg-card px-2 py-1 text-foreground shadow-sm"
                >
                  {item}
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <RevenueChart
              rows={financial?.data}
              locale={locale}
              emptyMessage={t("panels.noData")}
            />
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              {t("panels.recentSalesTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailySales && dailySales.sales.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("panels.member")}</TableHead>
                    <TableHead>{t("panels.totalHeader")}</TableHead>
                    <TableHead>{t("panels.paymentMethod")}</TableHead>
                    <TableHead className="text-end">{t("panels.time")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailySales.sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">
                        {sale.member?.name ?? `Sale #${sale.id}`}
                      </TableCell>
                      <TableCell className="font-bold">
                        {formatCurrency(sale.total, locale)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.payment_method}
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        {formatTime(sale.created_at, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message={t("panels.noData")} />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              {t("charts.topProductsTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary && summary.top_products.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("panels.product")}</TableHead>
                    <TableHead className="text-end">{t("panels.unitsSold")}</TableHead>
                    <TableHead className="text-end">{t("panels.revenue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.top_products.map((product) => (
                    <TableRow key={product.product_id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        {product.units_sold}
                      </TableCell>
                      <TableCell className="text-end font-bold">
                        {formatCurrency(product.revenue, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message={t("panels.noData")} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              {t("panels.lowStockTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock && lowStock.data.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("panels.product")}</TableHead>
                    <TableHead className="text-end">{t("panels.inStockHeader")}</TableHead>
                    <TableHead className="text-end">{t("panels.threshold")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.data.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-end">
                        <span
                          className={cn(
                            "font-bold",
                            product.is_low_stock ? "text-rose-600" : "text-foreground"
                          )}
                        >
                          {product.stock_quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        {product.low_stock_threshold}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message={t("panels.noData")} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              {t("panels.expiringSoonTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiring && expiring.data.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("panels.member")}</TableHead>
                    <TableHead>{t("panels.ends")}</TableHead>
                    <TableHead className="text-end">{t("panels.renew")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiring.data.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell className="font-medium">
                        {subscription.member?.name ??
                          `Member #${subscription.member?.id ?? subscription.id}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(subscription.end_date, locale)}
                      </TableCell>
                      <TableCell className="text-end">
                        <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                          {t("panels.renew")}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message={t("panels.noData")} />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid h-40 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function SparkLine({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 44" className={className} fill="none">
      <path
        d="M2 34L16 29L28 31L42 18L54 22L68 9L78 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
    </svg>
  );
}

function SparkBars({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 44" className={className} fill="currentColor">
      {[12, 24, 18, 34, 28, 39].map((height, index) => (
        <rect
          key={height + index}
          height={height}
          rx="2"
          width="8"
          x={index * 13 + 2}
          y={42 - height}
        />
      ))}
    </svg>
  );
}

function formatCurrency(value: string | number, locale: string) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "-";
  return num.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
  });
}

function formatDate(dateInput: string | Date, locale: string) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateInput: string | Date, locale: string) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
