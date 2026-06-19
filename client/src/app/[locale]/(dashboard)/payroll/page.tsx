import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Banknote, Clock3, CreditCard, Users } from "lucide-react";
import { PayrollFilterBar } from "@/components/payroll/payroll-filter-bar";
import { PayrollPagination } from "@/components/payroll/payroll-pagination";
import { PayrollTableContainer } from "@/components/payroll/payroll-table-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPayroll, type Paginated, type Payroll } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PayrollPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function PayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string;
    month?: string;
    status?: string;
    employee_id?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("PayrollPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const month = normalizeMonth(resolvedSearchParams.month);
  const status = normalizeStatus(resolvedSearchParams.status);
  const employeeId = normalizeEmployeeId(resolvedSearchParams.employee_id);
  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let payrollResult: Paginated<Payroll> = {
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
    payrollResult = await getPayroll({ page, month, status, employeeId });
  } catch {
    fetchError = t("fetchError");
  }

  const visibleNet = payrollResult.data.reduce((sum, item) => {
    const amount = Number(item.net_salary);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const pendingCount = payrollResult.data.filter((item) => item.status === "pending").length;
  const paidCount = payrollResult.data.filter((item) => item.status === "paid").length;
  const employeeCount = new Set(payrollResult.data.map((item) => item.employee.id)).size;

  const stats = [
    {
      label: t("statRecords"),
      value: payrollResult.meta.total,
      hint: t("statRecordsHint"),
      icon: CreditCard,
      className: "bg-primary/15 text-primary",
    },
    {
      label: t("statVisibleNet"),
      value: formatCurrency(visibleNet, locale),
      hint: t("statVisibleNetHint"),
      icon: Banknote,
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("statPending"),
      value: pendingCount,
      hint: t("statPendingHint", { count: paidCount }),
      icon: Clock3,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    {
      label: t("statEmployees"),
      value: employeeCount,
      hint: t("statEmployeesHint"),
      icon: Users,
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
          <PayrollFilterBar />
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
              {t("tableDescription", { count: payrollResult.meta.total })}
            </p>
          </div>
        </div>
        <PayrollTableContainer payroll={payrollResult.data} />
        <PayrollPagination
          currentPage={payrollResult.meta.current_page || 1}
          lastPage={payrollResult.meta.last_page || 1}
        />
      </Card>
    </div>
  );
}

function normalizeMonth(value?: string) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : undefined;
}

function normalizeStatus(value?: string) {
  return value === "pending" || value === "paid" ? value : undefined;
}

function normalizeEmployeeId(value?: string) {
  return value && /^[1-9][0-9]*$/.test(value) ? value : undefined;
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
