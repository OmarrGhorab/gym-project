import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarDays, ReceiptText, Tags, WalletCards } from "lucide-react";
import { ExpensesFilterBar } from "@/components/expenses/expenses-filter-bar";
import { ExpensesPagination } from "@/components/expenses/expenses-pagination";
import { ExpensesTableContainer } from "@/components/expenses/expenses-table-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getExpenses, type Paginated, type Expense } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ExpensesPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string;
    category?: string;
    start_date?: string;
    end_date?: string;
    sort?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ExpensesPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const category = sanitizeText(resolvedSearchParams.category);
  const startDate = normalizeDate(resolvedSearchParams.start_date);
  const endDate = normalizeDate(resolvedSearchParams.end_date);
  const sort = normalizeSort(resolvedSearchParams.sort);
  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let expensesResult: Paginated<Expense> = {
    data: [],
    meta: {
      current_page: 1,
      per_page: 15,
      total: 0,
      last_page: 1,
    },
  };
  let fetchError: string | null = null;

  try {
    expensesResult = await getExpenses({
      page,
      category,
      startDate,
      endDate,
      sort,
    });
  } catch {
    fetchError = t("fetchError");
  }

  const visibleTotal = expensesResult.data.reduce((sum, expense) => {
    const amount = Number(expense.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const categoriesCount = new Set(expensesResult.data.map((expense) => expense.category)).size;

  const stats = [
    {
      label: t("statFilteredTotal"),
      value: formatCurrency(expensesResult.meta.total_amount ?? "0", locale),
      hint: t("statFilteredTotalHint"),
      icon: WalletCards,
      className: "bg-primary/15 text-primary",
    },
    {
      label: t("statVisibleTotal"),
      value: formatCurrency(visibleTotal, locale),
      hint: t("statVisibleTotalHint"),
      icon: ReceiptText,
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("statCategories"),
      value: categoriesCount,
      hint: t("statCategoriesHint"),
      icon: Tags,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    {
      label: t("statPageSize"),
      value: expensesResult.meta.per_page,
      hint: t("statPageSizeHint"),
      icon: CalendarDays,
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
              <CardTitle className="text-sm font-bold text-card-foreground">{stat.label}</CardTitle>
              <span className={cn("grid size-8 place-items-center rounded-lg", stat.className)}>
                <stat.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black tracking-tight text-foreground tabular-nums">
                {typeof stat.value === "number" ? stat.value.toLocaleString(dateLocale) : stat.value}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border shadow-xs">
        <CardContent className="p-4">
          <ExpensesFilterBar />
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
            <p className="text-xs font-semibold text-muted-foreground">{t("tableDescription")}</p>
          </div>
        </div>
        <ExpensesTableContainer expenses={expensesResult.data} />
        <ExpensesPagination
          currentPage={expensesResult.meta.current_page}
          lastPage={expensesResult.meta.last_page}
        />
      </Card>
    </div>
  );
}

function sanitizeText(value?: string) {
  return value?.trim() || undefined;
}

function normalizeDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function normalizeSort(value?: string) {
  const allowed = new Set(["date", "-date", "amount", "-amount", "created_at", "-created_at"]);
  return allowed.has(value ?? "") ? value as "date" | "-date" | "amount" | "-amount" | "created_at" | "-created_at" : "-date";
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
