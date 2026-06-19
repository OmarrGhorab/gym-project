"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { AppLocale } from "@/i18n/routing";
import { markNotificationAsRead } from "@/lib/actions/notifications";
import type { Notification } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function NotificationsTable({
  notifications,
}: {
  notifications: Notification[];
}) {
  const locale = useLocale();
  const t = useTranslations("NotificationsPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<Notification>[]>(
    () => [
      {
        accessorKey: "data",
        header: t("tableNotification"),
        cell: ({ row }) => (
          <div className={cn("min-w-72", isArabic && "text-right")}>
            <div className="flex items-start gap-2">
              {!row.original.read_at && (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
              )}
              <div>
                <p className="text-sm font-black text-foreground">
                  {getNotificationTitle(row.original)}
                </p>
                <p className="line-clamp-2 max-w-xl text-xs font-semibold text-muted-foreground">
                  {getNotificationBody(row.original) || row.original.type}
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: t("tableType"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="rounded-md bg-muted/40 px-2 py-0.5 text-xs font-bold text-muted-foreground"
          >
            {formatNotificationType(row.original.type)}
          </Badge>
        ),
      },
      {
        accessorKey: "read_at",
        header: t("tableStatus"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs font-bold",
              row.original.read_at
                ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-amber-500/20 bg-amber-500/15 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
            )}
          >
            {row.original.read_at ? t("statusRead") : t("statusUnread")}
          </Badge>
        ),
      },
      {
        accessorKey: "created_at",
        header: t("tableCreated"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatDate(row.original.created_at, dateLocale)}
          </span>
        ),
      },
      {
        accessorKey: "read_at_date",
        header: t("tableReadAt"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {row.original.read_at
              ? formatDate(row.original.read_at, dateLocale)
              : "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => (
          <span className={cn("block", isArabic ? "text-left" : "text-right")}>
            {t("tableActions")}
          </span>
        ),
        cell: ({ row }) => <NotificationActions notification={row.original} />,
      },
    ],
    [dateLocale, isArabic, t]
  );

  return (
    <DataTable
      columns={columns}
      data={notifications}
      emptyMessage={t("empty")}
      isArabic={isArabic}
    />
  );
}

function NotificationActions({
  notification,
}: {
  notification: Notification;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("NotificationsPage");
  const [isPending, setIsPending] = React.useState(false);
  const isRead = Boolean(notification.read_at);

  async function handleMarkRead() {
    if (isRead) return;

    setIsPending(true);
    try {
      await markNotificationAsRead(notification.id, locale as AppLocale);
      toast.success(t("markReadSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("markReadError"));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={isRead ? t("alreadyRead") : t("actionMarkRead")}
        onClick={handleMarkRead}
        disabled={isRead || isPending}
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="size-3.5" />
        )}
      </Button>
    </div>
  );
}

function getNotificationTitle(notification: Notification): string {
  if (
    notification.data &&
    "title" in notification.data &&
    typeof notification.data.title === "string"
  ) {
    return notification.data.title;
  }

  return formatNotificationType(notification.type);
}

function getNotificationBody(notification: Notification): string {
  if (
    notification.data &&
    "body" in notification.data &&
    typeof notification.data.body === "string"
  ) {
    return notification.data.body;
  }

  if (
    notification.data &&
    "message" in notification.data &&
    typeof notification.data.message === "string"
  ) {
    return notification.data.message;
  }

  return "";
}

function formatNotificationType(type: string) {
  return type
    .split("\\")
    .pop()!
    .replace(/Notification$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ");
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
