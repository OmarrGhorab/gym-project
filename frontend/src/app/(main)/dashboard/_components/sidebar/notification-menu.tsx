"use client";

import { Bell, CalendarClock, CircleDollarSign, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const notifications = [
  {
    id: "trial-ending",
    titleKey: "trialEndingTitle",
    descriptionKey: "trialEndingDescription",
    icon: CalendarClock,
  },
  {
    id: "payment-due",
    titleKey: "paymentDueTitle",
    descriptionKey: "paymentDueDescription",
    icon: CircleDollarSign,
  },
  {
    id: "new-member",
    titleKey: "newMemberTitle",
    descriptionKey: "newMemberDescription",
    icon: UserPlus,
  },
] as const;

export function NotificationMenu() {
  const t = useTranslations("Dashboard.shell");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon" aria-label={t("openNotifications")}>
            <Bell />
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
          {notifications.map((notification) => {
            const Icon = notification.icon;

            return (
              <DropdownMenuItem key={notification.id} className="items-start gap-2 py-2">
                <Icon className="mt-0.5" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{t(`notificationsItems.${notification.titleKey}`)}</span>
                  <span className="text-muted-foreground text-xs">
                    {t(`notificationsItems.${notification.descriptionKey}`)}
                  </span>
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
