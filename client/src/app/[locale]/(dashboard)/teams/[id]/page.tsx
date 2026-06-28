import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, BadgeDollarSign, CalendarCheck2, QrCode, ReceiptText, TrendingUp } from "lucide-react";
import { getAttendanceViolations, getEmployee, getSingleEmployeePerformance } from "@/lib/api/dashboard";
import type { AttendanceViolation } from "@/lib/api/dashboard";
import { StaticQrCode } from "@/components/attendance/static-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export default async function EmployeePerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("TeamsPage");
  const isArabic = locale === "ar";
  const resolvedSearchParams = await searchParams;
  const from = normalizeDate(resolvedSearchParams.from) ?? monthStart();
  const to = normalizeDate(resolvedSearchParams.to) ?? today();
  const [employee, performance, violationsResult] = await Promise.all([
    getEmployee(Number(id)),
    getSingleEmployeePerformance(id, { from, to }),
    getAttendanceViolations({ employeeId: id }).catch(() => ({ data: [] as AttendanceViolation[] })),
  ]);

  if (!employee || !performance) {
    notFound();
  }

  const stats = [
    {
      label: t("performanceSales"),
      value: performance.sales_count,
      hint: formatDelta(performance.comparison?.sales_count_delta ?? 0, locale),
      icon: ReceiptText,
      tone: "bg-primary/15 text-primary",
    },
    {
      label: t("performanceSalesVolume"),
      value: formatCurrency(performance.sales_volume ?? "0.00", locale),
      hint: formatCurrencyDelta(performance.comparison?.sales_volume_delta ?? "0.00", locale),
      icon: TrendingUp,
      tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("performanceSubscriptions"),
      value: performance.subscriptions_count,
      hint: formatDelta(performance.comparison?.subscriptions_count_delta ?? 0, locale),
      icon: CalendarCheck2,
      tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    {
      label: t("performanceCommissions"),
      value: formatCurrency(performance.commissions_earned, locale),
      hint: formatCurrencyDelta(performance.comparison?.commissions_delta ?? "0.00", locale),
      icon: BadgeDollarSign,
      tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className={cn(isArabic && "text-right")}>
          <Button asChild variant="outline" className="mb-4 w-fit gap-2">
            <Link href="/teams">
              <ArrowLeft className="size-4" />
              {t("backToTeams")}
            </Link>
          </Button>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            {t("performancePageTitle", { name: employee.name })}
          </h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {t("performancePageDescription", { from, to })}
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
                {typeof stat.value === "number" ? stat.value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US") : stat.value}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
          <Info label={t("tableRole")} value={employee.role} isArabic={isArabic} />
          <Info label={t("tableStatus")} value={employee.status} isArabic={isArabic} />
          <Info label={t("tableCommission")} value={formatPercent(employee.commission_rate, locale)} isArabic={isArabic} />
          <Info label={t("tableHireDate")} value={employee.hire_date ?? "-"} isArabic={isArabic} />
          <Info label={t("tableShift")} value={employee.shift ? `${employee.shift.name} · ${employee.shift.starts_at}-${employee.shift.ends_at}` : t("shiftUnassigned")} isArabic={isArabic} />
          <Info label={t("tableAttendance")} value={String(performance.attendance_count ?? 0)} isArabic={isArabic} />
          <Info label={t("tableSalesVolume")} value={formatCurrency(performance.previous_sales_volume ?? "0.00", locale)} isArabic={isArabic} />
          <Info label={t("tableWarnings")} value={String(violationsResult.data.length)} isArabic={isArabic} />
        </CardContent>
      </Card>

      {employee.attendance_qr ? (
        <Card>
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="rounded-md bg-white p-3 shadow-sm">
              <StaticQrCode value={employee.attendance_qr} size={128} />
            </div>
            <div className={cn(isArabic && "text-right")}>
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-primary" />
                <h2 className="text-base font-black text-foreground">{t("employeeQrTitle")}</h2>
              </div>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{t("employeeQrDescription")}</p>
              <p className="mt-3 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs font-bold text-foreground">
                {employee.attendance_qr}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Info({ label, value, isArabic }: { label: string; value: string; isArabic: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-muted/15 p-4", isArabic && "text-right")}>
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-black text-foreground">{value}</p>
    </div>
  );
}

function normalizeDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
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

function formatCurrencyDelta(value: string, locale: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  const formatted = formatCurrency(Math.abs(amount), locale);
  return amount > 0 ? `+${formatted}` : amount < 0 ? `-${formatted}` : formatted;
}

function formatDelta(value: number, locale: string) {
  const formatted = Math.abs(value).toLocaleString(locale === "ar" ? "ar-EG" : "en-US");
  return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : formatted;
}

function formatPercent(value: string | number, locale: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  });
}
