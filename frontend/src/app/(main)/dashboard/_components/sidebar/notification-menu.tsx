import { getTranslations } from "next-intl/server";

import { serverApiFetch } from "@/lib/api/server";

import { NotificationMenuClient, type NotificationRow } from "./notification-menu-client";

type PaginatedData<T> = {
  data?: T[];
};

export async function NotificationMenu() {
  const t = await getTranslations("Dashboard.shell");
  const notifications = await getUnreadNotifications();

  return (
    <NotificationMenuClient
      initialNotifications={notifications}
      labels={{
        approveFreeze: t("approveFreeze"),
        dismissFreeze: t("dismissFreeze"),
        empty: t("notificationsItems.paymentDueDescription"),
        latestActivity: t("latestActivity"),
        markAllRead: t("markAllRead"),
        markRead: t("markRead"),
        notificationCenter: t("notificationCenter"),
        notifications: t("notifications"),
        openNotifications: t("openNotifications"),
        working: t("working"),
      }}
    />
  );
}

async function getUnreadNotifications() {
  try {
    const result = await serverApiFetch<NotificationRow[] | PaginatedData<NotificationRow>>(
      "/notifications?unread=1&page=1",
    );

    return unwrapList(result.data);
  } catch {
    return [];
  }
}

function unwrapList<T>(value: T[] | PaginatedData<T>): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return Array.isArray(value.data) ? value.data : [];
}
