import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  AlertCircle,
  CalendarDays,
  CreditCard,
  Dumbbell,
  RefreshCw,
  Settings2,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const expiringCount = expiring?.data.length ?? 0;
  const totalRevenueNumber = Number.parseFloat(revenueTotal);
  const topProduct = summary?.top_products[0];
  const stockHealthCount = lowStock?.data.filter((product) => product.is_low_stock).length ?? 0;

  const stats = [
    {
      label: t("stats.todayRevenue"),
      value: formatCurrency(dailySales?.total_revenue ?? 0, locale),
      hint: format(selectedDate, "MMM d", { locale: dateFnsLocale }),
      change: dailySales?.sales.length
        ? t("panels.transactionsToday", { count: dailySales.sales.length })
        : t("panels.noData"),
      icon: TrendingUp,
      tone: "bg-primary/15 text-primary",
      badge: revenuePeak > 0 ? formatCurrency(revenuePeak, locale) : t("panels.noData"),
      badgeLabel: t("stats.peak"),
    },
    {
      label: t("stats.todaySales"),
      value: String(dailySales?.sales.length ?? 0),
      hint: format(selectedDate, "MMM d", { locale: dateFnsLocale }),
      change: "",
      icon: ShoppingBag,
      tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
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
      icon: CreditCard,
      tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      badge: String(summary?.active_subscriptions ?? 0),
      badgeLabel: t("stats.activeShort"),
    },
    {
      label: t("stats.expiringThisWeek"),
      value: String(summary?.expiring_soon ?? 0),
      hint: t("panels.expiringSoonTitle"),
      change: "",
      icon: CalendarDays,
      tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
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
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            {dateLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <RefreshCw className="size-4" />
            <span>{t("panels.liveSnapshot")}</span>
          </div>
          <Button size="sm" variant="outline">
            <Settings2 data-icon="inline-start" />
            {t("panels.operations")}
          </Button>
          <DashboardDatePicker date={toStr} locale={locale} />
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

      <Tabs defaultValue="dashboard" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList variant="line">
            <TabsTrigger value="dashboard">{t("panels.dashboardTab")}</TabsTrigger>
            <TabsTrigger value="sales">{t("panels.salesTab")}</TabsTrigger>
            <TabsTrigger value="inventory">{t("panels.inventoryTab")}</TabsTrigger>
          </TabsList>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <TabsContent value="dashboard" className="flex flex-col gap-4">
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 xl:col-span-7">
              <div className="grid grid-cols-1 md:grid-cols-2">
                {stats.map((stat, index) => (
                  <Card
                    key={stat.label}
                    className={cn(
                      "gap-5 rounded-none border-0 ring-0",
                      index < 2 && "border-b border-foreground/10",
                      index % 2 === 0 && "md:border-r md:border-foreground/10",
                      index === 1 && "md:border-r-0"
                    )}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-3 text-sm font-normal text-muted-foreground">
                        <span>{stat.label}</span>
                        <span className={cn("grid size-8 place-items-center rounded-md", stat.tone)}>
                          <stat.icon className="size-4" />
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-end justify-between gap-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="break-words text-[clamp(1.7rem,2.4vw,2.2rem)] font-black leading-none tracking-tight tabular-nums">
                          {stat.value}
                        </div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {stat.change || stat.hint || stat.badgeLabel}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="max-w-[8.5rem] truncate rounded-md bg-primary/10 text-xs font-bold text-primary"
                      >
                        {stat.badge}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 xl:col-span-5">
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="font-normal">{t("panels.incomeSources")}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                  <SourceBar
                    label={t("panels.revenue")}
                    meta="100%"
                    value={formatCurrency(totalRevenueNumber, locale)}
                    tone="bg-primary"
                  />
                  <SourceBar
                    label={t("stats.todayRevenue")}
                    meta={t("today")}
                    value={formatCurrency(dailySales?.total_revenue ?? 0, locale)}
                    tone="bg-chart-4"
                  />
                  <SourceBar
                    label={topProduct?.name ?? t("charts.topProductsTitle")}
                    meta={topProduct ? t("panels.units", { count: topProduct.units_sold }) : t("panels.noData")}
                    value={topProduct ? formatCurrency(topProduct.revenue, locale) : "-"}
                    tone="bg-chart-2"
                  />
                </CardContent>
              </Card>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                    <Dumbbell className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{t("panels.gymPulseTitle")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("panels.gymPulseDescription", {
                        sales: dailySales?.sales.length ?? 0,
                        expiring: expiringCount,
                      })}
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-md">
                    {t("today")}
                  </Badge>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="rounded-xl xl:col-span-7">
              <CardHeader>
                <CardTitle className="font-normal">{t("charts.revenueTitle")}</CardTitle>
                <CardDescription>
                  {t("charts.revenueTotal", {
                    total: formatCurrency(totalRevenueNumber, locale),
                  })}
                </CardDescription>
                <CardAction>
                  <Badge variant="outline" className="rounded-md">
                    {t("charts.period30Days")}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <RevenueChart
                  className="h-64"
                  rows={revenueRows}
                  locale={locale}
                  emptyMessage={t("panels.noData")}
                />
              </CardContent>
            </Card>

            <Card className="rounded-xl xl:col-span-5">
              <CardHeader>
                <CardTitle className="font-normal">{t("panels.recentSalesTitle")}</CardTitle>
                <CardDescription>
                  {t("panels.transactionsToday", {
                    count: dailySales?.sales.length ?? 0,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {dailySales && dailySales.sales.length > 0 ? (
                  <div className={ledger.shell}>
                    <Table className={ledger.table}>
                      <colgroup>
                        <col className="w-[38%]" />
                        <col className="w-[28%]" />
                        <col className="w-[34%]" />
                      </colgroup>
                      <TableHeader className={ledger.header}>
                        <TableRow className={ledger.headerRow}>
                          <TableHead className={ledger.headerCell}>{t("panels.member")}</TableHead>
                          <TableHead className={ledger.headerCell}>{t("panels.totalHeader")}</TableHead>
                          <TableHead className={cn(ledger.headerCell, "text-end")}>{t("panels.time")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailySales.sales.slice(0, 6).map((sale) => (
                          <TableRow key={sale.id} className={ledger.row}>
                            <TableCell className={ledger.firstCell}>
                              <span className="block min-w-0 break-words leading-5">
                                {sale.member?.name ?? `Sale #${sale.id}`}
                              </span>
                            </TableCell>
                            <TableCell className={cn(ledger.cell, "font-black tabular-nums")}>
                              {formatCurrency(sale.total, locale)}
                            </TableCell>
                            <TableCell className={cn(ledger.lastCell, "text-end text-[11px] font-bold text-muted-foreground tabular-nums")}>
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

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <LedgerCard
              title={t("charts.topProductsTitle")}
              description={t("panels.bestRevenueByProduct")}
            >
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
            </LedgerCard>

            <LedgerCard
              title={t("panels.lowStockTitle")}
              description={t("panels.itemsNeedAttention", { count: stockHealthCount })}
            >
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
            </LedgerCard>

            <LedgerCard
              title={t("panels.expiringSoonTitle")}
              description={t("panels.subscriptionsDueSoon", { count: expiringCount })}
            >
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
            </LedgerCard>
          </section>
        </TabsContent>

        <TabsContent value="sales">
          <EmptyState message={t("panels.salesTabHint")} />
        </TabsContent>

        <TabsContent value="inventory">
          <EmptyState message={t("panels.inventoryTabHint")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LedgerCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="font-normal">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-3 pb-3">{children}</CardContent>
    </Card>
  );
}

function SourceBar({
  label,
  meta,
  value,
  tone,
}: {
  label: string;
  meta: string;
  value: string;
  tone: string;
}) {
  return (
    <section className="isolate flex gap-[0.5px]">
      <Separator
        orientation="vertical"
        className="mb-1 h-auto self-auto border-l border-dashed border-muted-foreground/50 bg-transparent"
      />
      <div className="flex min-h-24 flex-1 flex-col justify-between">
        <div className="flex min-w-0 flex-col gap-1 px-1">
          <p className="break-words text-xs leading-none text-muted-foreground">
            {label} · {meta}
          </p>
          <div className="break-words text-lg font-semibold leading-none tracking-tight tabular-nums">
            {value}
          </div>
        </div>
        <div className={cn("-ms-0.5 h-5 rounded-sm", tone)} />
      </div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid h-40 place-items-center rounded-[8px] border border-dashed bg-background/50 text-sm font-medium text-muted-foreground">
      {message}
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
