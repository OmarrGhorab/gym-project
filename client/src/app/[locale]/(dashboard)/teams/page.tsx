import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeDollarSign, BriefcaseBusiness, UserCheck, Users } from "lucide-react";
import {
  getEmployeeShifts,
  getEmployees,
  getRoles,
  type Employee,
  type EmployeeShift,
  type Paginated,
  type Role,
} from "@/lib/api/dashboard";
import { TeamFilterBar } from "@/components/teams/team-filter-bar";
import { TeamPagination } from "@/components/teams/team-pagination";
import { TeamTableContainer } from "@/components/teams/team-table-container";
import Breadcrumb3 from "@/components/ui/breadcrumb-3";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "TeamsPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function TeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; role?: string; status?: string; search?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("TeamsPage");
  const shellT = await getTranslations("DashboardShell");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const role = resolvedSearchParams.role === "all" ? undefined : resolvedSearchParams.role;
  const status = resolvedSearchParams.status === "all" ? undefined : resolvedSearchParams.status;
  const search = resolvedSearchParams.search || undefined;
  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let employees: Employee[] = [];
  let roles: Role[] = [];
  let shifts: EmployeeShift[] = [];
  let meta: Paginated<Employee>["meta"] = {
    current_page: 1,
    per_page: 15,
    total: 0,
    last_page: 1,
  };
  let fetchError: string | null = null;

  try {
    const [employeesResult, rolesResult, shiftsResult] = await Promise.all([
      getEmployees({ page, role, status, search }),
      getRoles().catch(() => []),
      getEmployeeShifts().catch(() => []),
    ]);
    employees = employeesResult.data;
    meta = employeesResult.meta;
    roles = rolesResult;
    shifts = shiftsResult;
  } catch {
    fetchError = t("fetchError");
  }

  const activeCount = employees.filter((employee) => employee.status === "active").length;
  const captainCount = employees.filter((employee) => employee.role === "captain").length;
  const monthlyPayroll = employees.reduce((sum, employee) => {
    const salary = Number(employee.base_salary);
    return Number.isFinite(salary) ? sum + salary : sum;
  }, 0);

  const stats = [
    { label: t("statTotal"), value: meta.total, hint: t("statTotalHint"), icon: Users, tone: "bg-primary/15 text-primary" },
    { label: t("statActive"), value: activeCount, hint: t("statActiveHint"), icon: UserCheck, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    { label: t("statCaptains"), value: captainCount, hint: t("statCaptainsHint"), icon: BriefcaseBusiness, tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
    { label: t("statPayroll"), value: formatCurrency(monthlyPayroll, locale), hint: t("statPayrollHint"), icon: BadgeDollarSign, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className={cn(isArabic && "text-right")}>
          <Breadcrumb3
            homeHref={`/${locale}`}
            homeLabel={shellT("nav.dashboard")}
            currentLabel={t("breadcrumb")}
            currentIcon={Users}
            dateLabel={dateLabel}
            className={cn(isArabic && "flex justify-end")}
          />
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
          <TeamFilterBar />
        </CardContent>
      </Card>

      {fetchError && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {fetchError}
        </div>
      )}

      <Card className="overflow-hidden border shadow-xs">
        <div className="border-b bg-muted/15 px-4 py-4">
          <h2 className={cn("text-base font-black text-foreground", isArabic && "text-right")}>{t("tableTitle")}</h2>
          <p className={cn("text-xs font-semibold text-muted-foreground", isArabic && "text-right")}>
            {t("tableDescription", { count: meta.total })}
          </p>
        </div>
        <TeamTableContainer employees={employees} roles={roles} shifts={shifts} />
        <TeamPagination currentPage={meta.current_page || 1} lastPage={meta.last_page || 1} />
      </Card>
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
