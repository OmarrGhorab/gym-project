import { Bell, ClipboardList, Package, ReceiptText, UserPlus, WalletCards } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { serverApiFetch } from "@/lib/api/server";

type NotificationRow = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string | null;
};

type PaginatedData<T> = {
  data?: T[];
};

const iconMap = [
  { match: "inventory", icon: Package },
  { match: "membership", icon: UserPlus },
  { match: "payroll", icon: WalletCards },
  { match: "tasks", icon: ClipboardList },
  { match: "sales", icon: ReceiptText },
] as const;

export async function NotificationMenu() {
  const t = await getTranslations("Dashboard.shell");
  const notifications = await getUnreadNotifications();
  const visibleNotifications = notifications.slice(0, 5);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon" aria-label={t("openNotifications")} className="relative">
            <Bell />
            {notifications.length > 0 ? (
              <span className="absolute -end-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                {Math.min(notifications.length, 9)}
              </span>
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent className="w-80 rounded-lg" align="end" side="bottom" sideOffset={8}>
        <div className="px-2 py-1.5">
          <p className="font-medium text-sm">{t("notifications")}</p>
          <p className="text-muted-foreground text-xs">{t("latestActivity")}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {visibleNotifications.length > 0 ? (
            visibleNotifications.map((notification) => {
              const Icon = iconForNotification(notification);

              return (
                <DropdownMenuItem key={notification.id} className="items-start gap-2 py-2">
                  <Icon className="mt-0.5" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">{notificationTitle(notification.data)}</span>
                    <span className="line-clamp-2 text-muted-foreground text-xs">
                      {notificationBody(notification.data)}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })
          ) : (
            <DropdownMenuItem className="items-start gap-2 py-2 text-muted-foreground">
              <Bell className="mt-0.5" />
              <span className="text-xs">{t("notificationsItems.paymentDueDescription")}</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<a href="/dashboard/mail" />}>{t("notificationCenter")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

function notificationTitle(data: Record<string, unknown>) {
  return String(data.title ?? data.subject ?? data.message ?? "Notification");
}

function notificationBody(data: Record<string, unknown>) {
  return String(data.body ?? data.description ?? data.member_name ?? data.plan_name ?? "");
}

function iconForNotification(notification: NotificationRow) {
  const category = String(notification.data.category ?? notification.type).toLowerCase();

  return iconMap.find((entry) => category.includes(entry.match))?.icon ?? Bell;
}
