import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle, CalendarCheck2, Clock3, UserCheck } from "lucide-react";
import { AttendanceFilterBar } from "@/components/attendance/attendance-filter-bar";
import { AttendancePagination } from "@/components/attendance/attendance-pagination";
import { AttendanceSummaryTable } from "@/components/attendance/attendance-summary-table";
import { AttendanceTableContainer } from "@/components/attendance/attendance-table-container";
import { MemberVisitsTable } from "@/components/attendance/member-visits-table";
import Breadcrumb3 from "@/components/ui/breadcrumb-3";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAttendance, getAttendanceSummary, getMemberVisits, type Attendance, type AttendanceSummary, type MemberVisit, type Paginated } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AttendancePage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string;
    employee_id?: string;
    status?: string;
    from?: string;
    to?: string;
    sort?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AttendancePage");
  const shellT = await getTranslations("DashboardShell");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const employeeId = sanitizeInteger(resolvedSearchParams.employee_id);
  const status = normalizeStatus(resolvedSearchParams.status);
  const from = normalizeDate(resolvedSearchParams.from);
  const to = normalizeDate(resolvedSearchParams.to);
  const sort = normalizeSort(resolvedSearchParams.sort);
  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let attendanceResult: Paginated<Attendance> = {
    data: [],
    meta: {
      current_page: 1,
      per_page: 15,
      total: 0,
      last_page: 1,
    },
  };
  let summary: AttendanceSummary[] = [];
  let memberVisits: MemberVisit[] = [];
  let fetchError: string | null = null;

  try {
    const [attendanceRows, summaryRows, visitRows] = await Promise.all([
      getAttendance({
        page,
        employeeId,
        status,
        from,
        to,
        sort,
      }),
      getAttendanceSummary({ month: from?.slice(0, 7), employeeId }).catch(() => []),
      getMemberVisits({ sort: "-check_in_at" }).catch(() => ({ data: [] })),
    ]);
    attendanceResult = attendanceRows;
    summary = summaryRows;
    memberVisits = visitRows.data;
  } catch {
    fetchError = t("fetchError");
  }

  const presentCount = attendanceResult.data.filter((row) => row.status === "present").length;
  const lateCount = attendanceResult.data.filter((row) => row.status === "late").length;
  const absentCount = attendanceResult.data.filter((row) => row.status === "absent").length;
  const checkedInCount = attendanceResult.data.filter((row) => row.check_in).length;

  const stats = [
    {
      label: t("statRecords"),
      value: attendanceResult.meta.total,
      hint: t("statRecordsHint"),
      icon: CalendarCheck2,
      className: "bg-primary/15 text-primary",
    },
    {
      label: t("statPresent"),
      value: presentCount,
      hint: t("statPresentHint"),
      icon: UserCheck,
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("statLate"),
      value: lateCount,
      hint: t("statLateHint"),
      icon: Clock3,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    {
      label: t("statAbsent"),
      value: absentCount,
      hint: t("statAbsentHint", { count: checkedInCount }),
      icon: AlertTriangle,
      className: "bg-destructive/15 text-destructive",
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
            currentIcon={CalendarCheck2}
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
              <CardTitle className="text-sm font-bold text-card-foreground">{stat.label}</CardTitle>
              <span className={cn("grid size-8 place-items-center rounded-lg", stat.className)}>
                <stat.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black tracking-tight text-foreground tabular-nums">
                {stat.value.toLocaleString(dateLocale)}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border shadow-xs">
        <CardContent className="p-4">
          <AttendanceFilterBar />
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
              {t("tableDescription", { count: attendanceResult.meta.total })}
            </p>
          </div>
        </div>
        <AttendanceTableContainer attendance={attendanceResult.data} />
        <AttendancePagination
          currentPage={attendanceResult.meta.current_page}
          lastPage={attendanceResult.meta.last_page}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden border shadow-xs">
          <div className="border-b bg-muted/15 px-4 py-4">
            <div className={cn(isArabic && "text-right")}>
              <h2 className="text-base font-black text-foreground">{t("summaryTitle")}</h2>
              <p className="text-xs font-semibold text-muted-foreground">{t("summaryDescription")}</p>
            </div>
          </div>
          <AttendanceSummaryTable rows={summary} />
        </Card>
        <Card className="overflow-hidden border shadow-xs">
          <div className="border-b bg-muted/15 px-4 py-4">
            <div className={cn(isArabic && "text-right")}>
              <h2 className="text-base font-black text-foreground">{t("memberVisitsTitle")}</h2>
              <p className="text-xs font-semibold text-muted-foreground">{t("memberVisitsDescription")}</p>
            </div>
          </div>
          <MemberVisitsTable visits={memberVisits} />
        </Card>
      </div>
    </div>
  );
}

function sanitizeInteger(value?: string) {
  return value && /^[1-9]\d*$/.test(value) ? value : undefined;
}

function normalizeDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function normalizeStatus(value?: string) {
  const allowed = new Set(["present", "absent", "late", "excused"]);
  return allowed.has(value ?? "") ? value : undefined;
}

function normalizeSort(value?: string) {
  const allowed = new Set(["date", "-date", "check_in", "-check_in", "created_at", "-created_at"]);
  return allowed.has(value ?? "")
    ? value as "date" | "-date" | "check_in" | "-check_in" | "created_at" | "-created_at"
    : "-date";
}
