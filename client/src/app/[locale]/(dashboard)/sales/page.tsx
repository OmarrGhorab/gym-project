import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Ban, Banknote, CreditCard, ReceiptText } from "lucide-react";
import { getAllSales, getSales, type Paginated, type Sale } from "@/lib/api/dashboard";
import { SalesFilterBar } from "@/components/sales/sales-filter-bar";
import { SalesPagination } from "@/components/sales/sales-pagination";
import { SalesTable } from "@/components/sales/sales-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SalesPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function SalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string;
    status?: string;
    payment_method?: string;
    member_id?: string;
    sort?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("SalesPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const status = normalizeStatus(resolvedSearchParams.status);
  const paymentMethod = normalizePaymentMethod(resolvedSearchParams.payment_method);
  const memberId = resolvedSearchParams.member_id || undefined;
  const sort = normalizeSort(resolvedSearchParams.sort);
  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let sales: Sale[] = [];
  let statsSales: Sale[] = [];
  let meta: Paginated<Sale>["meta"] = {
    current_page: 1,
    per_page: 15,
    total: 0,
    last_page: 1,
  };
  let fetchError: string | null = null;

  try {
    const [result, statsResult] = await Promise.all([
      getSales({ page, status, paymentMethod, memberId, sort }),
      getAllSales({ status, paymentMethod, memberId, sort }),
    ]);
    sales = result.data;
    statsSales = statsResult;
    meta = result.meta;
  } catch {
    fetchError = t("fetchError");
  }

  const completed = statsSales.filter((sale) => sale.status === "completed").length;
  const voided = statsSales.filter((sale) => sale.status === "voided").length;
  const revenue = statsSales.reduce((sum, sale) => {
    if (sale.status === "voided") return sum;
    const total = Number(sale.total);
    return Number.isFinite(total) ? sum + total : sum;
  }, 0);
  const averageSale = completed > 0 ? revenue / completed : 0;

  const stats = [
    {
      label: t("statTotal"),
      value: meta.total,
      hint: t("statTotalHint"),
      icon: ReceiptText,
      className: "bg-primary/15 text-primary",
    },
    {
      label: t("statRevenue"),
      value: formatCurrency(revenue, locale),
      hint: t("statRevenueHint"),
      icon: Banknote,
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("statAverage"),
      value: formatCurrency(averageSale, locale),
      hint: t("statAverageHint"),
      icon: CreditCard,
      className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    {
      label: t("statVoided"),
      value: voided,
      hint: t("statVoidedHint"),
      icon: Ban,
      className: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className={cn(isArabic && "text-right")}>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            {isArabic ? (
              <>
                <span>{dateLabel}</span>
                <span className="text-muted-foreground/30">/</span>
                <span className="font-bold text-primary">{t("breadcrumb")}</span>
              </>
            ) : (
              <>
                <span className="font-bold text-primary">{t("breadcrumb")}</span>
                <span className="text-muted-foreground/30">/</span>
                <span>{dateLabel}</span>
              </>
            )}
          </div>
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
          <SalesFilterBar />
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
        <SalesTable sales={sales} />
        <SalesPagination currentPage={meta.current_page || 1} lastPage={meta.last_page || 1} />
      </Card>
    </div>
  );
}

function normalizeStatus(value?: string) {
  return value === "completed" || value === "voided" ? value : undefined;
}

function normalizePaymentMethod(value?: string) {
  return value === "cash" || value === "card" || value === "bank_transfer" ? value : undefined;
}

function normalizeSort(value?: string) {
  const allowed = new Set(["created_at", "-created_at", "total", "-total", "subtotal", "-subtotal"]);
  return allowed.has(value ?? "")
    ? value as "created_at" | "-created_at" | "total" | "-total" | "subtotal" | "-subtotal"
    : "-created_at";
}

function formatCurrency(value: number, locale: string) {
  return value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });
}
