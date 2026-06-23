import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeDollarSign, Dumbbell, Target, Trophy } from "lucide-react";
import { format, subDays } from "date-fns";
import {
  getEmployeePerformance,
  getEmployees,
  type Employee,
  type EmployeePerformance,
  type Paginated,
} from "@/lib/api/dashboard";
import { TeamFilterBar } from "@/components/teams/team-filter-bar";
import { TeamPagination } from "@/components/teams/team-pagination";
import { TeamTableContainer } from "@/components/teams/team-table-container";
import { TrainerPerformanceTable } from "@/components/trainers/trainer-performance-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "TrainersPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function TrainersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; role?: string; status?: string; search?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("TrainersPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const role = resolvedSearchParams.role === "all" ? undefined : resolvedSearchParams.role ?? "captain";
  const status = resolvedSearchParams.status === "all" ? undefined : resolvedSearchParams.status;
  const search = resolvedSearchParams.search || undefined;
  const today = new Date();
  const from = format(subDays(today, 29), "yyyy-MM-dd");
  const to = format(today, "yyyy-MM-dd");
  const dateLabel = today.toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let trainers: Employee[] = [];
  let performance: EmployeePerformance[] = [];
  let meta: Paginated<Employee>["meta"] = {
    current_page: 1,
    per_page: 15,
    total: 0,
    last_page: 1,
  };
  let fetchError: string | null = null;

  try {
    const [employeesResult, performanceResult] = await Promise.all([
      getEmployees({ page, role, status, search }),
      getEmployeePerformance({ from, to }).catch(() => []),
    ]);
    trainers = employeesResult.data;
    meta = employeesResult.meta;
    const trainerIds = new Set(trainers.map((trainer) => trainer.id));
    performance = performanceResult
      .filter((row) => row.role === "captain" || trainerIds.has(row.employee_id))
      .sort((a, b) => Number(b.commissions_earned) - Number(a.commissions_earned));
  } catch {
    fetchError = t("fetchError");
  }

  const totalSubscriptions = performance.reduce((sum, row) => sum + row.subscriptions_count, 0);
  const totalSales = performance.reduce((sum, row) => sum + row.sales_count, 0);
  const totalCommissions = performance.reduce((sum, row) => {
    const amount = Number(row.commissions_earned);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const leader = performance[0]?.name ?? "-";

  const stats = [
    { label: t("statTrainers"), value: meta.total, hint: t("statTrainersHint"), icon: Dumbbell, tone: "bg-primary/15 text-primary" },
    { label: t("statSubscriptions"), value: totalSubscriptions, hint: t("statPeriod"), icon: Target, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    { label: t("statCommissions"), value: formatCurrency(totalCommissions, locale), hint: t("statPeriod"), icon: BadgeDollarSign, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    { label: t("statLeader"), value: leader, hint: t("statSales", { count: totalSales }), icon: Trophy, tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
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
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">{t("title")}</h1>
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
              <span className={cn("grid size-8 place-items-center rounded-lg", stat.tone)}>
                <stat.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="truncate text-3xl font-black tracking-tight text-foreground tabular-nums">
                {typeof stat.value === "number" ? stat.value.toLocaleString(dateLocale) : stat.value}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border shadow-xs">
        <CardContent className="p-4">
          <TeamFilterBar namespace="TrainersPage" />
        </CardContent>
      </Card>

      {fetchError && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {fetchError}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="overflow-hidden border shadow-xs">
          <div className="border-b bg-muted/15 px-4 py-4">
            <h2 className={cn("text-base font-black text-foreground", isArabic && "text-right")}>{t("tableTitle")}</h2>
            <p className={cn("text-xs font-semibold text-muted-foreground", isArabic && "text-right")}>
              {t("tableDescription", { count: meta.total })}
            </p>
          </div>
          <TeamTableContainer employees={trainers} namespace="TrainersPage" />
          <TeamPagination currentPage={meta.current_page || 1} lastPage={meta.last_page || 1} />
        </Card>

        <Card className="overflow-hidden border shadow-xs">
          <div className="border-b bg-muted/15 px-4 py-4">
            <h2 className={cn("text-base font-black text-foreground", isArabic && "text-right")}>{t("performanceTitle")}</h2>
            <p className={cn("text-xs font-semibold text-muted-foreground", isArabic && "text-right")}>
              {t("performanceDescription")}
            </p>
          </div>
          <TrainerPerformanceTable rows={performance} />
        </Card>
      </section>
    </div>
  );
}

function formatCurrency(value: number, locale: string) {
  return value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });
}
