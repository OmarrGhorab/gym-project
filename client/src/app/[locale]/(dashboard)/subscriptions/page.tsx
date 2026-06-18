import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Activity,
  CalendarClock,
  CirclePause,
  CreditCard,
  Snowflake,
} from "lucide-react";
import {
  getDashboardSummary,
  getSubscriptions,
  type Paginated,
  type Subscription,
} from "@/lib/api/dashboard";
import { SubscriptionsFilterBar } from "@/components/subscriptions/subscriptions-filter-bar";
import { SubscriptionsPagination } from "@/components/subscriptions/subscriptions-pagination";
import { SubscriptionsTable } from "@/components/subscriptions/subscriptions-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SubscriptionsPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function SubscriptionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string;
    status?: string;
    member_id?: string;
    sort?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("SubscriptionsPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const status = resolvedSearchParams.status === "all" ? undefined : resolvedSearchParams.status;
  const memberId = resolvedSearchParams.member_id || undefined;
  const sort = normalizeSort(resolvedSearchParams.sort);
  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let subscriptions: Subscription[] = [];
  let meta: Paginated<Subscription>["meta"] = {
    current_page: 1,
    per_page: 15,
    total: 0,
    last_page: 1,
  };
  let activeTotal = 0;
  let fetchError: string | null = null;

  try {
    const [subscriptionsResult, summaryResult] = await Promise.all([
      getSubscriptions({ page, status, memberId, sort }),
      getDashboardSummary().catch(() => null),
    ]);

    subscriptions = subscriptionsResult.data;
    meta = subscriptionsResult.meta;
    activeTotal = summaryResult?.active_subscriptions ?? countByStatus(subscriptions, "active");
  } catch {
    fetchError = t("fetchError");
  }

  const expiringSoon = subscriptions.filter((subscription) => {
    const days = getDaysLeft(subscription.end_date);
    return subscription.status === "active" && days >= 0 && days <= 7;
  }).length;
  const frozen = countByStatus(subscriptions, "frozen");
  const stopped = countByStatus(subscriptions, "stopped");
  const revenue = subscriptions.reduce((sum, subscription) => {
    const amount = Number(subscription.price_paid);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  const stats = [
    {
      label: t("statActive"),
      value: activeTotal,
      hint: t("statActiveHint"),
      icon: Activity,
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("statExpiring"),
      value: expiringSoon,
      hint: t("statExpiringHint"),
      icon: CalendarClock,
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
    {
      label: t("statFrozen"),
      value: frozen,
      hint: t("statFrozenHint"),
      icon: Snowflake,
      className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    {
      label: t("statStopped"),
      value: stopped,
      hint: formatCurrency(revenue, locale),
      icon: CirclePause,
      className: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
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
          <SubscriptionsFilterBar />
        </CardContent>
      </Card>

      {fetchError && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {fetchError}
        </div>
      )}

      <Card className="overflow-hidden border shadow-xs">
        <div className="flex flex-col gap-3 border-b bg-muted/15 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className={cn(isArabic && "text-right")}>
            <h2 className="text-base font-black text-foreground">{t("tableTitle")}</h2>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("tableDescription", { count: meta.total })}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-bold text-muted-foreground">
            <CreditCard className="size-4 text-primary" />
            {t("backendShape")}
          </div>
        </div>
        <SubscriptionsTable subscriptions={subscriptions} />
        <SubscriptionsPagination
          currentPage={meta.current_page || 1}
          lastPage={meta.last_page || 1}
        />
      </Card>
    </div>
  );
}

function normalizeSort(value?: string) {
  const allowed = new Set(["created_at", "-created_at", "start_date", "-start_date", "end_date", "-end_date"]);
  return allowed.has(value ?? "") ? value as "created_at" | "-created_at" | "start_date" | "-start_date" | "end_date" | "-end_date" : "end_date";
}

function countByStatus(subscriptions: Subscription[], status: string) {
  return subscriptions.filter((subscription) => subscription.status?.toLowerCase() === status).length;
}

function getDaysLeft(value: string) {
  const end = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (Number.isNaN(end.getTime())) {
    return 0;
  }

  return Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function formatCurrency(value: number, locale: string) {
  return value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });
}
