import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle, Boxes, CircleDollarSign, PackageCheck } from "lucide-react";
import { getAllProducts, getProducts, type Paginated, type Product } from "@/lib/api/dashboard";
import { ProductsFilterBar } from "@/components/products/products-filter-bar";
import { ProductsPagination } from "@/components/products/products-pagination";
import { ProductsTableContainer } from "@/components/products/products-table-container";
import Breadcrumb3 from "@/components/ui/breadcrumb-3";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ProductsPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    stock?: string;
    sort?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ProductsPage");
  const shellT = await getTranslations("DashboardShell");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const isActive = normalizeStatus(resolvedSearchParams.status);
  const isLowStock = resolvedSearchParams.stock === "low";
  const sort = normalizeSort(resolvedSearchParams.sort);
  const search = resolvedSearchParams.search || undefined;
  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let products: Product[] = [];
  let statsProducts: Product[] = [];
  let meta: Paginated<Product>["meta"] = {
    current_page: 1,
    per_page: 15,
    total: 0,
    last_page: 1,
  };
  let fetchError: string | null = null;

  try {
    const [result, statsResult] = await Promise.all([
      getProducts({ page, search, isActive, isLowStock, sort }),
      getAllProducts({ search, isActive, isLowStock, sort }),
    ]);
    products = result.data;
    statsProducts = statsResult;
    meta = result.meta;
  } catch {
    fetchError = t("fetchError");
  }

  const activeCount = statsProducts.filter((product) => product.is_active).length;
  const lowStockCount = statsProducts.filter((product) => product.is_low_stock).length;
  const inventoryValue = statsProducts.reduce((sum, product) => {
    const cost = Number(product.cost);
    return Number.isFinite(cost) ? sum + cost * product.stock_quantity : sum;
  }, 0);

  const stats = [
    {
      label: t("statTotal"),
      value: meta.total,
      hint: t("statTotalHint"),
      icon: Boxes,
      className: "bg-primary/15 text-primary",
    },
    {
      label: t("statActive"),
      value: activeCount,
      hint: t("statActiveHint"),
      icon: PackageCheck,
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("statLowStock"),
      value: lowStockCount,
      hint: t("statLowStockHint"),
      icon: AlertTriangle,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    {
      label: t("statValue"),
      value: formatCurrency(inventoryValue, locale),
      hint: t("statValueHint"),
      icon: CircleDollarSign,
      className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
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
            currentIcon={Boxes}
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

      <Card className="border shadow-xs">
        <CardContent className="p-4">
          <ProductsFilterBar />
        </CardContent>
      </Card>

      {fetchError && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {fetchError}
        </div>
      )}

      <Card className="overflow-hidden border shadow-xs">
        <div className="border-b bg-muted/15 px-4 py-4">
          <div className={cn(isArabic && "text-right")}>
            <h2 className="text-base font-black text-foreground">{t("tableTitle")}</h2>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("tableDescription", { count: meta.total })}
            </p>
          </div>
        </div>
        <ProductsTableContainer products={products} />
        <ProductsPagination currentPage={meta.current_page || 1} lastPage={meta.last_page || 1} />
      </Card>
    </div>
  );
}

function normalizeStatus(value?: string) {
  return value === "1" || value === "0" ? value : undefined;
}

function normalizeSort(value?: string) {
  const allowed = new Set(["name", "-name", "price", "-price", "stock_quantity", "-stock_quantity", "created_at", "-created_at"]);
  return allowed.has(value ?? "") ? value as "name" | "-name" | "price" | "-price" | "stock_quantity" | "-stock_quantity" | "created_at" | "-created_at" : "-created_at";
}

function formatCurrency(value: number, locale: string) {
  return value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });
}
