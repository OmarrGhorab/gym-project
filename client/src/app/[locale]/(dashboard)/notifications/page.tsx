import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Bell, BellDot, CheckCircle2, Clock3 } from "lucide-react";
import { NotificationsFilterBar } from "@/components/notifications/notifications-filter-bar";
import { NotificationsPagination } from "@/components/notifications/notifications-pagination";
import { NotificationsTable } from "@/components/notifications/notifications-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getNotificationsPaginated,
  type Notification,
  type Paginated,
} from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "NotificationsPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function NotificationsPage({
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
  const t = await getTranslations("NotificationsPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const status = normalizeStatus(resolvedSearchParams.status);
  const unreadFilter = status === "unread" ? "1" : undefined;
  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let notifications: Notification[] = [];
  let meta: Paginated<Notification>["meta"] = {
    current_page: 1,
    per_page: 15,
    total: 0,
    last_page: 1,
  };
  let fetchError: string | null = null;

  try {
    const result = await getNotificationsPaginated({
      page,
      unread: unreadFilter,
    });
    notifications = result.data;
    meta = result.meta;
  } catch {
    fetchError = t("fetchError");
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.read_at
  ).length;
  const readCount = notifications.filter(
    (notification) => notification.read_at
  ).length;
  const latestNotification = notifications[0]?.created_at
    ? formatDate(notifications[0].created_at, dateLocale)
    : "-";

  const stats = [
    {
      label: t("statTotal"),
      value: meta.total,
      hint: t("statTotalHint"),
      icon: Bell,
      className: "bg-primary/15 text-primary",
    },
    {
      label: t("statUnread"),
      value: unreadCount,
      hint: t("statUnreadHint"),
      icon: BellDot,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    {
      label: t("statRead"),
      value: readCount,
      hint: t("statReadHint"),
      icon: CheckCircle2,
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("statLatest"),
      value: latestNotification,
      hint: t("statLatestHint"),
      icon: Clock3,
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
          <NotificationsFilterBar />
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
        <NotificationsTable notifications={notifications} />
        <NotificationsPagination
          currentPage={meta.current_page || 1}
          lastPage={meta.last_page || 1}
        />
      </Card>
    </div>
  );
}

function normalizeStatus(value?: string) {
  return value === "unread" ? value : undefined;
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
