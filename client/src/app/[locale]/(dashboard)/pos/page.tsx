import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Banknote, CreditCard, PackageSearch, ReceiptText } from "lucide-react";
import { getAllProducts, getSales, type Product, type Sale } from "@/lib/api/dashboard";
import { PosCheckout } from "@/components/pos/pos-checkout";
import Breadcrumb3 from "@/components/ui/breadcrumb-3";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PosPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function PosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("PosPage");
  const shellT = await getTranslations("DashboardShell");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let products: Product[] = [];
  let recentSales: Sale[] = [];
  let fetchError: string | null = null;

  try {
    const [productsResult, salesResult] = await Promise.all([
      getAllProducts({ isActive: "1", sort: "name" }),
      getSales({ sort: "-created_at" }),
    ]);
    products = productsResult;
    recentSales = salesResult.data.slice(0, 5);
  } catch {
    fetchError = t("fetchError");
  }

  const availableProducts = products.filter((product) => product.stock_quantity > 0).length;
  const lowStockProducts = products.filter((product) => product.is_low_stock).length;
  const recentRevenue = recentSales.reduce((sum, sale) => {
    const total = Number(sale.total);
    return Number.isFinite(total) ? sum + total : sum;
  }, 0);

  const stats = [
    {
      label: t("statProducts"),
      value: availableProducts,
      hint: t("statProductsHint"),
      icon: PackageSearch,
      className: "bg-primary/15 text-primary",
    },
    {
      label: t("statLowStock"),
      value: lowStockProducts,
      hint: t("statLowStockHint"),
      icon: ReceiptText,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    {
      label: t("statRecentSales"),
      value: recentSales.length,
      hint: t("statRecentSalesHint"),
      icon: CreditCard,
      className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    {
      label: t("statRevenue"),
      value: formatCurrency(recentRevenue, locale),
      hint: t("statRevenueHint"),
      icon: Banknote,
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className={cn(isArabic && "text-right")}>
          <Breadcrumb3
            homeHref={`/${locale}`}
            homeLabel={shellT("nav.dashboard")}
            currentLabel={t("breadcrumb")}
            currentIcon={ReceiptText}
            dateLabel={dateLabel}
            className={cn(isArabic && "flex justify-end")}
          />
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-lg shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-bold text-card-foreground">
                {stat.label}
              </CardTitle>
              <span className={cn("grid size-8 place-items-center rounded-lg", stat.className)}>
                <stat.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black tracking-tight text-foreground tabular-nums">
                {typeof stat.value === "number" ? stat.value.toLocaleString(dateLocale) : stat.value}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {stat.hint}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      {fetchError && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {fetchError}
        </div>
      )}

      <PosCheckout products={products} />

      <Card className="border shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-black text-card-foreground">
            {t("recentTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentSales.map((sale) => (
            <div key={sale.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/10 p-3">
              <div className={cn(isArabic && "text-right")}>
                <p className="text-sm font-bold text-foreground">#{sale.id}</p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {formatDate(sale.created_at, dateLocale)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="rounded-md text-xs font-bold">
                  {paymentLabel(sale.payment_method, t)}
                </Badge>
                <p className="text-sm font-black text-foreground tabular-nums">
                  {formatCurrency(sale.total, locale)}
                </p>
              </div>
            </div>
          ))}
          {recentSales.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm font-semibold text-muted-foreground">
              {t("recentEmpty")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatCurrency(value: string | number, locale: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentLabel(method: string, t: (key: string) => string) {
  switch (method) {
    case "card":
      return t("paymentCard");
    case "bank_transfer":
      return t("paymentBank");
    default:
      return t("paymentCash");
  }
}
