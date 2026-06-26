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
      badge: revenuePeak > 0 ? formatCurrency(revenuePeak, locale) : t("panels.noData"),
      badgeLabel: t("stats.peak"),
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
      badge: String(dailySales?.sales.length ?? 0),
      badgeLabel: t("stats.transactionsLabel"),
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
      badge: String(summary?.active_subscriptions ?? 0),
      badgeLabel: t("stats.activeShort"),
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
      badge: String(expiringCount),
      badgeLabel: t("stats.dueSoon"),
    },
  ];

  const ledger = {
    shell:
      "overflow-hidden rounded-[8px] bg-background/60 p-2 ring-1 ring-border/70",
    table: "w-full table-fixed border-separate border-spacing-y-2 text-[12px] sm:text-[13px]",
    header: "[&_tr]:border-0",
    headerRow: "border-0 hover:bg-transparent",
    headerCell:
      "h-7 min-w-0 whitespace-normal break-words px-2 text-[9px] font-black uppercase text-muted-foreground sm:px-3 sm:text-[10px]",
    row: "border-0 hover:bg-transparent",
    firstCell:
      "min-w-0 whitespace-normal break-words rounded-s-[8px] border-y border-s bg-card px-2 py-3 font-bold shadow-sm sm:px-3",
    cell: "min-w-0 whitespace-normal break-words border-y bg-card px-2 py-3 shadow-sm sm:px-3",
    lastCell:
      "min-w-0 whitespace-normal break-words rounded-e-[8px] border-y border-e bg-card px-2 py-3 shadow-sm sm:px-3",
  };

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
            <CardContent className="space-y-3">
              <div className="min-w-0">
                <p className="break-words text-[clamp(1.55rem,2vw,1.875rem)] font-black leading-none tracking-tight text-foreground tabular-nums">
                  {stat.value}
                </p>
              </div>
              <div
                className={cn(
                  "flex min-h-9 w-full items-center justify-between gap-2 rounded-[8px] px-3 py-2",
                  stat.accent
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <stat.icon className="size-3.5 shrink-0" />
                  <span className="truncate">{stat.badgeLabel}</span>
                </span>
                <span className="min-w-0 truncate text-end text-xs font-black text-foreground tabular-nums">
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

      <section>
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
      </section>

      <section>
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
          <CardContent className="px-3 pb-3 pt-3">
            {dailySales && dailySales.sales.length > 0 ? (
              <div className={ledger.shell}>
                <Table className={ledger.table}>
                  <colgroup>
                    <col className="w-[34%]" />
                    <col className="w-[23%]" />
                    <col className="w-[23%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <TableHeader className={ledger.header}>
                    <TableRow className={ledger.headerRow}>
                      <TableHead className={ledger.headerCell}>{t("panels.member")}</TableHead>
                      <TableHead className={ledger.headerCell}>{t("panels.totalHeader")}</TableHead>
                      <TableHead className={ledger.headerCell}>{t("panels.paymentMethod")}</TableHead>
                      <TableHead className={cn(ledger.headerCell, "text-end")}>{t("panels.time")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailySales.sales.map((sale) => (
                      <TableRow key={sale.id} className={ledger.row}>
                        <TableCell className={ledger.firstCell}>
                          <span className="block min-w-0 break-words leading-5">
                            {sale.member?.name ?? `Sale #${sale.id}`}
                          </span>
                        </TableCell>
                        <TableCell className={cn(ledger.cell, "text-[11px] font-black tabular-nums sm:text-xs")}>
                          {formatCurrency(sale.total, locale)}
                        </TableCell>
                        <TableCell className={cn(ledger.cell, "text-muted-foreground")}>
                          <span className="inline-flex max-w-full items-center justify-center rounded-full border border-border/70 bg-muted/70 px-2 py-1 text-center text-[9px] font-black uppercase leading-4 text-muted-foreground sm:px-2.5 sm:text-[10px]">
                            {formatPaymentMethod(sale.payment_method, {
                              cash: t("panels.paymentCashShort"),
                              card: t("panels.paymentCardShort"),
                              bank_transfer: t("panels.paymentBankShort"),
                            })}
                          </span>
                        </TableCell>
                        <TableCell className={cn(ledger.lastCell, "whitespace-nowrap text-end text-[11px] font-bold text-muted-foreground tabular-nums sm:text-xs")}>
                          {formatTime(sale.created_at, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
          <CardContent className="px-3 pb-3 pt-3">
            {summary && summary.top_products.length > 0 ? (
              <div className={ledger.shell}>
                <Table className={ledger.table}>
                  <colgroup>
                    <col className="w-[48%]" />
                    <col className="w-[22%]" />
                    <col className="w-[30%]" />
                  </colgroup>
                  <TableHeader className={ledger.header}>
                    <TableRow className={ledger.headerRow}>
                      <TableHead className={ledger.headerCell}>{t("panels.product")}</TableHead>
                      <TableHead className={cn(ledger.headerCell, "text-end")}>{t("panels.unitsSold")}</TableHead>
                      <TableHead className={cn(ledger.headerCell, "text-end")}>{t("panels.revenue")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.top_products.map((product, index) => (
                      <TableRow key={product.product_id} className={ledger.row}>
                        <TableCell className={ledger.firstCell}>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
                              {index + 1}
                            </span>
                            <span className="min-w-0 break-words leading-5">
                              {product.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className={cn(ledger.cell, "text-end text-muted-foreground")}>
                          <span className="inline-flex max-w-full justify-center rounded-full bg-muted/80 px-2 py-1 text-[10px] font-black uppercase">
                            {product.units_sold}
                          </span>
                        </TableCell>
                        <TableCell className={cn(ledger.lastCell, "text-end text-[11px] font-black tabular-nums sm:text-xs")}>
                          {formatCurrency(product.revenue, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
          <CardContent className="px-3 pb-3 pt-3">
            {lowStock && lowStock.data.length > 0 ? (
              <div className={ledger.shell}>
                <Table className={ledger.table}>
                  <colgroup>
                    <col className="w-[50%]" />
                    <col className="w-[25%]" />
                    <col className="w-[25%]" />
                  </colgroup>
                  <TableHeader className={ledger.header}>
                    <TableRow className={ledger.headerRow}>
                      <TableHead className={ledger.headerCell}>{t("panels.product")}</TableHead>
                      <TableHead className={cn(ledger.headerCell, "text-end")}>{t("panels.inStockHeader")}</TableHead>
                      <TableHead className={cn(ledger.headerCell, "text-end")}>{t("panels.threshold")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock.data.map((product) => (
                      <TableRow key={product.id} className={ledger.row}>
                        <TableCell className={ledger.firstCell}>
                          <span className="block min-w-0 break-words leading-5">
                            {product.name}
                          </span>
                        </TableCell>
                        <TableCell className={cn(ledger.cell, "text-end")}>
                          <span
                            className={cn(
                              "inline-flex min-w-8 justify-center rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums",
                              product.is_low_stock
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : "bg-muted text-foreground"
                            )}
                          >
                            {product.stock_quantity}
                          </span>
                        </TableCell>
                        <TableCell className={cn(ledger.lastCell, "text-end font-bold text-muted-foreground tabular-nums")}>
                          {product.low_stock_threshold}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
          <CardContent className="px-3 pb-3 pt-3">
            {expiring && expiring.data.length > 0 ? (
              <div className={ledger.shell}>
                <Table className={ledger.table}>
                  <colgroup>
                    <col className="w-[42%]" />
                    <col className="w-[32%]" />
                    <col className="w-[26%]" />
                  </colgroup>
                  <TableHeader className={ledger.header}>
                    <TableRow className={ledger.headerRow}>
                      <TableHead className={ledger.headerCell}>{t("panels.member")}</TableHead>
                      <TableHead className={ledger.headerCell}>{t("panels.ends")}</TableHead>
                      <TableHead className={cn(ledger.headerCell, "text-end")}>{t("panels.renew")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiring.data.map((subscription) => (
                      <TableRow key={subscription.id} className={ledger.row}>
                        <TableCell className={ledger.firstCell}>
                          <span className="block min-w-0 break-words leading-5">
                            {subscription.member?.name ??
                              `Member #${subscription.member?.id ?? subscription.id}`}
                          </span>
                        </TableCell>
                        <TableCell className={cn(ledger.cell, "text-[11px] font-bold text-muted-foreground tabular-nums sm:text-xs")}>
                          {formatDate(subscription.end_date, locale)}
                        </TableCell>
                        <TableCell className={cn(ledger.lastCell, "text-end")}>
                          <span className="inline-flex max-w-full justify-center rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-center text-[10px] font-black uppercase leading-4 text-primary">
                            {t("panels.renew")}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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

function formatPaymentMethod(
  value: string,
  labels: Record<"cash" | "card" | "bank_transfer", string>
) {
  return labels[value as keyof typeof labels] ?? value.replaceAll("_", " ");
}
