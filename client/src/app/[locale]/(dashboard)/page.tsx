import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  AlertCircle,
  CalendarDays,
  CreditCard,
  Package,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const revenueTotal = financial?.meta?.totals.revenue ?? "0.00";
  const revenueRows = financial?.data ?? [];
  const revenuePeak = revenueRows.reduce((peak, row) => {
    const value = Number.parseFloat(row.revenue);
    return Number.isFinite(value) && value > peak ? value : peak;
  }, 0);
  const lowStockCount = lowStock?.data.length ?? 0;
  const expiringCount = expiring?.data.length ?? 0;

  const stats = [
    {
      label: t("stats.todayRevenue"),
      value: formatCurrency(dailySales?.total_revenue ?? 0, locale),
      hint: format(selectedDate, "MMM d", { locale: dateFnsLocale }),
      change: dailySales?.sales.length
        ? t("panels.transactionsToday", { count: dailySales.sales.length })
        : "",
      positive: true,
      icon: TrendingUp,
      tone: "bg-primary/15 text-primary",
      accent: "bg-primary/10 text-foreground",
      badge: revenuePeak > 0
        ? t("stats.peak", { value: formatCurrency(revenuePeak, locale) })
        : t("panels.noData"),
    },
    {
      label: t("stats.todaySales"),
      value: String(dailySales?.sales.length ?? 0),
      hint: format(selectedDate, "MMM d", { locale: dateFnsLocale }),
      change: "",
      positive: true,
      icon: Package,
      tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
      accent: "bg-amber-500/10 text-foreground",
      badge: t("stats.transactions", { count: dailySales?.sales.length ?? 0 }),
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
      tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      accent: "bg-emerald-500/10 text-foreground",
      badge: t("stats.activeShort", { count: summary?.active_subscriptions ?? 0 }),
    },
    {
      label: t("stats.expiringThisWeek"),
      value: String(summary?.expiring_soon ?? 0),
      hint: t("panels.expiringSoonTitle"),
      change: "",
      positive: true,
      icon: CalendarDays,
      tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
      accent: "bg-rose-500/10 text-foreground",
      badge: t("stats.dueSoon", { count: expiringCount }),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="rounded-[8px] border bg-card/90 px-4 py-4 shadow-sm backdrop-blur-sm sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span>{t("eyebrow")}</span>
              <span className="text-border">/</span>
              <span>{dateLabel}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                {t("title")}
              </h1>
              <Badge
                variant="outline"
                className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary"
              >
                {t("today")}
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("description")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-[8px] border bg-background px-3 py-2 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {t("panels.totalHeader")}
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {formatCurrency(dailySales?.total_revenue ?? 0, locale)}
              </div>
            </div>
            <DashboardDatePicker date={toStr} locale={locale} />
          </div>
        </div>
      </header>

      {errors.length > 0 && (
        <Card className="rounded-[8px] border-rose-200 bg-rose-50 text-rose-900 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                {t("errors.loadTitle")}
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
          <Card
            key={stat.label}
            className="rounded-[8px] border shadow-sm"
          >
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-sm font-semibold text-muted-foreground">
                  {stat.label}
                </CardTitle>
                {stat.hint && (
                  <CardDescription className="text-[11px] font-medium uppercase tracking-[0.16em]">
                    {stat.hint}
                  </CardDescription>
                )}
              </div>
              <span className={cn("grid size-9 place-items-center rounded-[8px]", stat.tone)}>
                <stat.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-end 2xl:justify-between">
                <p className="text-3xl font-black tracking-tight text-foreground tabular-nums">
                  {stat.value}
                </p>
                <span
                  className={cn(
                    "inline-flex w-fit max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    stat.accent
                  )}
                >
                  <stat.icon className="size-3.5" />
                  {stat.badge}
                </span>
              </div>
              {stat.change && (
                <p
                  className={cn(
                    "text-xs font-bold",
                    stat.positive ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {stat.change}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="rounded-[8px] border shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4 border-b bg-muted/30 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-black tracking-tight">
                {t("charts.revenueTitle")}
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                {t("charts.revenueTotal", {
                  total: formatCurrency(Number.parseFloat(revenueTotal), locale),
                })}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary"
            >
              30d
            </Badge>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-4 sm:px-5">
            <RevenueChart
              className="h-80"
              rows={revenueRows}
              locale={locale}
              emptyMessage={t("panels.noData")}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniMetric
                icon={TrendingUp}
                label={t("panels.revenue")}
                value={formatCurrency(Number.parseFloat(revenueTotal), locale)}
                tone="bg-primary/10 text-primary"
              />
              <MiniMetric
                icon={CreditCard}
                label={t("stats.activeSubscriptions")}
                value={String(summary?.active_subscriptions ?? 0)}
                tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              />
              <MiniMetric
                icon={TriangleAlert}
                label={t("stats.expiringThisWeek")}
                value={String(expiringCount)}
                tone="bg-rose-500/10 text-rose-600 dark:text-rose-400"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[8px] border shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <CardTitle className="text-base font-black tracking-tight">
              {t("panels.recentSalesTitle")}
            </CardTitle>
            <CardDescription className="text-xs font-medium">
              {t("panels.transactionsToday", {
                count: dailySales?.sales.length ?? 0,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2 pt-0">
            {dailySales && dailySales.sales.length > 0 ? (
              <Table className="text-[13px]">
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
                      <TableCell className="max-w-[180px] truncate font-medium">
                        {sale.member?.name ?? `Sale #${sale.id}`}
                      </TableCell>
                      <TableCell className="font-bold tabular-nums">
                        {formatCurrency(sale.total, locale)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                          {sale.payment_method}
                        </span>
                      </TableCell>
                      <TableCell className="text-end font-medium text-muted-foreground">
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
        <Card className="rounded-[8px] border shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <CardTitle className="text-base font-black tracking-tight">
              {t("charts.topProductsTitle")}
            </CardTitle>
            <CardDescription className="text-xs font-medium">
              {t("panels.bestRevenueByProduct")}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2 pt-0">
            {summary && summary.top_products.length > 0 ? (
              <Table className="text-[13px]">
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
                      <TableCell className="max-w-[180px] truncate font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="text-end font-medium text-muted-foreground">
                        {product.units_sold}
                      </TableCell>
                      <TableCell className="text-end font-bold tabular-nums">
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

        <Card className="rounded-[8px] border shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <CardTitle className="text-base font-black tracking-tight">
              {t("panels.lowStockTitle")}
            </CardTitle>
            <CardDescription className="text-xs font-medium">
              {t("panels.itemsNeedAttention", { count: lowStockCount })}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2 pt-0">
            {lowStock && lowStock.data.length > 0 ? (
              <Table className="text-[13px]">
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
                      <TableCell className="max-w-[180px] truncate font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="text-end">
                        <span
                          className={cn(
                            "font-bold tabular-nums",
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

        <Card className="rounded-[8px] border shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <CardTitle className="text-base font-black tracking-tight">
              {t("panels.expiringSoonTitle")}
            </CardTitle>
            <CardDescription className="text-xs font-medium">
              {t("panels.subscriptionsDueSoon", { count: expiringCount })}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-2 pt-0">
            {expiring && expiring.data.length > 0 ? (
              <Table className="text-[13px]">
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
                      <TableCell className="max-w-[180px] truncate font-medium">
                        {subscription.member?.name ??
                          `Member #${subscription.member?.id ?? subscription.id}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {formatDate(subscription.end_date, locale)}
                      </TableCell>
                      <TableCell className="text-end">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
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
    <div className="grid h-40 place-items-center rounded-[8px] border border-dashed bg-background/50 text-sm font-medium text-muted-foreground">
      {message}
    </div>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-[8px] border bg-background px-3 py-3">
      <div className="flex items-center gap-2">
        <span className={cn("grid size-7 place-items-center rounded-[8px]", tone)}>
          <Icon className="size-3.5" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-2 text-base font-black tracking-tight text-foreground tabular-nums">
        {value}
      </div>
    </div>
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
