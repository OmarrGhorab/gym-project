"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Bell, ClipboardList, ClockAlert, Package, ReceiptText, UserPlus, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NotificationRow = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string | null;
};

type NotificationMenuClientProps = {
  initialNotifications: NotificationRow[];
  labels: {
    latestActivity: string;
    notificationCenter: string;
    notifications: string;
    openNotifications: string;
    empty: string;
  };
};

type NotificationStreamPayload = {
  notifications?: NotificationRow[];
  unread?: number;
};

const iconMap = [
  { match: "attendance", icon: ClockAlert },
  { match: "inventory", icon: Package },
  { match: "membership", icon: UserPlus },
  { match: "payroll", icon: WalletCards },
  { match: "tasks", icon: ClipboardList },
  { match: "sales", icon: ReceiptText },
] as const;

export function NotificationMenuClient({ initialNotifications, labels }: NotificationMenuClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialNotifications.length);
  const knownIds = useRef(new Set(initialNotifications.map((notification) => notification.id)));
  const visibleNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);

  useEffect(() => {
    const events = new EventSource("/api/notifications/stream");

    events.addEventListener("notifications", (event) => {
      const payload = JSON.parse(event.data) as NotificationStreamPayload;
      const nextNotifications = payload.notifications ?? [];
      const newNotifications = nextNotifications.filter((notification) => !knownIds.current.has(notification.id));

      for (const notification of nextNotifications) {
        knownIds.current.add(notification.id);
      }

      if (newNotifications.length > 0) {
        const latest = newNotifications[0];
        toast(notificationTitle(latest.data), {
          description: notificationBody(latest.data),
        });

        if (pathname === "/dashboard/mail") {
          router.refresh();
        }
      }

      setNotifications(nextNotifications);
      setUnreadCount(Number(payload.unread ?? nextNotifications.length));
    });

    return () => events.close();
  }, [pathname, router]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon" aria-label={labels.openNotifications} className="relative">
            <Bell />
            {unreadCount > 0 ? (
              <span className="absolute -end-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                {Math.min(unreadCount, 9)}
              </span>
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent className="w-80 rounded-lg" align="end" side="bottom" sideOffset={8}>
        <div className="px-2 py-1.5">
          <p className="font-medium text-sm">{labels.notifications}</p>
          <p className="text-muted-foreground text-xs">{labels.latestActivity}</p>
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
              <span className="text-xs">{labels.empty}</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard/mail" />}>{labels.notificationCenter}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
