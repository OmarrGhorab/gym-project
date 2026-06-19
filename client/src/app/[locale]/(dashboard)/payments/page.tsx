import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CreditCard, ReceiptText, TrendingUp, WalletCards } from "lucide-react";
import { PaymentDuesContainer } from "@/components/payments/payment-dues-container";
import { PaymentsFilterBar } from "@/components/payments/payments-filter-bar";
import { PaymentsPagination } from "@/components/payments/payments-pagination";
import { PaymentsTable } from "@/components/payments/payments-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPaymentDues,
  getPayments,
  type Paginated,
  type Payment,
  type PaymentDue,
} from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PaymentsPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string;
    status?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("PaymentsPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const status = normalizeStatus(resolvedSearchParams.status);
  const isDueMode = status === "due";
  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let payments: Payment[] = [];
  let dues: PaymentDue[] = [];
  let meta: Paginated<Payment | PaymentDue>["meta"] = {
    current_page: 1,
    per_page: 15,
    total: 0,
    last_page: 1,
  };
  let fetchError: string | null = null;

  try {
    if (isDueMode) {
      const result = await getPaymentDues({ page });
      dues = result.data;
      meta = result.meta;
    } else {
      const result = await getPayments({
        page,
        status: status === "paid" || status === "partial" ? status : undefined,
      });
      payments = result.data;
      meta = result.meta;
    }
  } catch {
    fetchError = t("fetchError");
  }

  const visibleRevenue = payments.reduce((sum, payment) => {
    const amount = Number(payment.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const visibleDueBalance = dues.reduce((sum, due) => {
    const amount = Number(due.balance);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const partialCount = payments.filter((payment) => payment.status === "partial").length;
  const paidCount = payments.filter((payment) => payment.status === "paid").length;

  const stats = [
    {
      label: t("statTotal"),
      value: meta.total,
      hint: isDueMode ? t("statTotalDueHint") : t("statTotalHint"),
      icon: ReceiptText,
      className: "bg-primary/15 text-primary",
    },
    {
      label: t("statCollected"),
      value: formatCurrency(visibleRevenue, locale),
      hint: t("statCollectedHint"),
      icon: CreditCard,
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("statDue"),
      value: formatCurrency(visibleDueBalance, locale),
      hint: t("statDueHint"),
      icon: WalletCards,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    {
      label: t("statStatus"),
      value: isDueMode ? dues.length : paidCount,
      hint: isDueMode
        ? t("statDueCountHint")
        : t("statPaidPartialHint", { count: partialCount }),
      icon: TrendingUp,
      className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
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
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-lg",
                  stat.className
                )}
              >
                <stat.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black tracking-tight text-foreground tabular-nums">
                {typeof stat.value === "number"
                  ? stat.value.toLocaleString(dateLocale)
                  : stat.value}
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
          <PaymentsFilterBar />
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
            <h2 className="text-base font-black text-foreground">
              {isDueMode ? t("duesTableTitle") : t("tableTitle")}
            </h2>
            <p className="text-xs font-semibold text-muted-foreground">
              {isDueMode
                ? t("duesTableDescription", { count: meta.total })
                : t("tableDescription", { count: meta.total })}
            </p>
          </div>
        </div>
        {isDueMode ? (
          <PaymentDuesContainer dues={dues} />
        ) : (
          <PaymentsTable payments={payments} />
        )}
        <PaymentsPagination
          currentPage={meta.current_page || 1}
          lastPage={meta.last_page || 1}
        />
      </Card>
    </div>
  );
}

function normalizeStatus(value?: string) {
  return value === "paid" || value === "partial" || value === "due"
    ? value
    : undefined;
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
