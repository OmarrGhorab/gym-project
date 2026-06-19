import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClipboardList, Database, MonitorCog, UserCog } from "lucide-react";
import { AuditFilterBar } from "@/components/audit/audit-filter-bar";
import { AuditPagination } from "@/components/audit/audit-pagination";
import { AuditTable } from "@/components/audit/audit-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAuditLogs,
  type AuditLog,
  type Paginated,
} from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

const subjectOptions = new Set([
  "member",
  "subscription",
  "sale",
  "payment",
  "payroll",
  "commission",
  "employee",
  "expense",
  "inventory_movement",
  "product",
  "plan",
  "subscription_freeze",
]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AuditPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string;
    from?: string;
    to?: string;
    subject?: string;
    causer?: string;
    sort?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("AuditPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const subject = normalizeSubject(resolvedSearchParams.subject);
  const sort = normalizeSort(resolvedSearchParams.sort);
  const from = normalizeDate(resolvedSearchParams.from);
  const to = normalizeDate(resolvedSearchParams.to);
  const causer = normalizeNumericFilter(resolvedSearchParams.causer);
  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let logs: AuditLog[] = [];
  let meta: Paginated<AuditLog>["meta"] = {
    current_page: 1,
    per_page: 15,
    total: 0,
    last_page: 1,
  };
  let fetchError: string | null = null;

  try {
    const result = await getAuditLogs({
      page,
      from,
      to,
      subject,
      causer,
      sort,
    });
    logs = result.data;
    meta = result.meta;
  } catch {
    fetchError = t("fetchError");
  }

  const userEvents = logs.filter((log) => log.causer_type === "user").length;
  const systemEvents = logs.filter((log) => log.causer_type === "system").length;
  const visibleSubjects = new Set(
    logs.map((log) => log.subject?.type).filter(Boolean)
  ).size;

  const stats = [
    {
      label: t("statTotal"),
      value: meta.total,
      hint: t("statTotalHint"),
      icon: ClipboardList,
      className: "bg-primary/15 text-primary",
    },
    {
      label: t("statUsers"),
      value: userEvents,
      hint: t("statUsersHint"),
      icon: UserCog,
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("statSystem"),
      value: systemEvents,
      hint: t("statSystemHint"),
      icon: MonitorCog,
      className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    {
      label: t("statSubjects"),
      value: visibleSubjects,
      hint: t("statSubjectsHint"),
      icon: Database,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
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
                {stat.value.toLocaleString(dateLocale)}
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
          <AuditFilterBar />
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
              {t("tableTitle")}
            </h2>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("tableDescription", { count: meta.total })}
            </p>
          </div>
        </div>
        <AuditTable logs={logs} />
        <AuditPagination
          currentPage={meta.current_page || 1}
          lastPage={meta.last_page || 1}
        />
      </Card>
    </div>
  );
}

function normalizeSubject(value?: string) {
  return value && subjectOptions.has(value) ? value : undefined;
}

function normalizeSort(value?: string) {
  return value === "created_at" || value === "-created_at"
    ? value
    : "-created_at";
}

function normalizeDate(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function normalizeNumericFilter(value?: string) {
  return value && /^[1-9][0-9]*$/.test(value) ? value : undefined;
}
