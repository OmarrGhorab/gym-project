"use client";

import * as React from "react";
import { Bell, Languages, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppTheme } from "@/components/theme-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/dashboard/user-avatar";
import type { DashboardUser } from "@/components/dashboard/types";
import type { Notification } from "@/lib/api/dashboard";
import { markNotificationAsRead } from "@/lib/actions/notifications";
import { logoutAction } from "@/lib/actions/logout";

export function DashboardNavbar({
  onOpenSidebar,
  user,
}: {
  onOpenSidebar: () => void;
  user: DashboardUser;
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("DashboardShell");
  const { theme, setTheme } = useAppTheme();
  const nextLocale = locale === "ar" ? "en" : "ar";
  const nextTheme = theme === "dark" ? "light" : "dark";
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notificationsLoaded, setNotificationsLoaded] = React.useState(false);
  const [notificationsError, setNotificationsError] = React.useState(false);

  async function loadNotifications() {
    if (notificationsLoaded) return;

    try {
      const response = await fetch("/api/dashboard/notifications?per_page=10", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: Notification[];
        meta?: { total?: number };
      };

      if (!response.ok) {
        throw new Error("Could not load notifications.");
      }

      setNotifications(payload.data ?? []);
      setUnreadCount(Number(payload.meta?.total ?? 0));
      setNotificationsLoaded(true);
      setNotificationsError(false);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsLoaded(true);
      setNotificationsError(true);
    }
  }

  async function handleNotificationClick(notificationId: string) {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read_at: notification.read_at ?? new Date().toISOString() }
            : notification
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      // Silently fail; the dropdown stays open.
    }
  }

  async function handleLogout() {
    await logoutAction(locale as "en" | "ar");
  }

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-30 border-b bg-card/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t("openSidebar")}
                  className="lg:hidden"
                  size="icon-lg"
                  type="button"
                  variant="outline"
                  onClick={onOpenSidebar}
                >
                  <Menu className="size-5" />
                </Button>
              }
            />
            <TooltipContent>{t("openSidebar")}</TooltipContent>
          </Tooltip>

          <div className="hidden min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-muted-foreground shadow-inner md:flex">
            <Search className="size-4 shrink-0" />
            <span className="truncate text-sm">{t("search")}</span>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      render={
                        <Button
                          className="relative"
                          size="icon-lg"
                          type="button"
                          variant="outline"
                          onClick={() => {
                            void loadNotifications();
                          }}
                        >
                          <Bell className="size-5" />
                          {unreadCount > 0 && (
                            <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500" />
                          )}
                        </Button>
                      }
                    />
                  }
                />
                <TooltipContent>{t("notifications")}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                className="w-80"
                side="bottom"
                sideOffset={8}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>{t("notifications")}</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        {unreadCount}
                      </span>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!notificationsLoaded ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      {t("notificationsLoading")}
                    </div>
                  ) : notificationsError ? (
                    <div className="px-2 py-4 text-center text-sm text-destructive">
                      {t("notificationsError")}
                    </div>
                  ) : notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className="relative flex cursor-default flex-col items-start gap-1 py-2"
                        onClick={() => handleNotificationClick(notification.id)}
                      >
                        {!notification.read_at && (
                          <span className="absolute top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                        <span
                          className={cn(
                            "text-sm font-medium",
                            !notification.read_at && "ps-3"
                          )}
                        >
                          {getNotificationTitle(notification)}
                        </span>
                        {getNotificationBody(notification) && (
                          <span className="text-xs text-muted-foreground">
                            {getNotificationBody(notification)}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/70">
                          {new Date(notification.created_at).toLocaleString(
                            locale === "ar" ? "ar-EG" : "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </span>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      {t("noNotifications")}
                    </div>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-lg"
                    type="button"
                    variant="outline"
                    onClick={() => setTheme(nextTheme)}
                  >
                    <Sun className="size-5 dark:hidden" />
                    <Moon className="hidden size-5 dark:block" />
                  </Button>
                }
              />
              <TooltipContent>{t("themeSwitch")}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    className="gap-2 px-3"
                    type="button"
                    variant="outline"
                    onClick={() => router.replace(pathname, { locale: nextLocale })}
                  >
                    <Languages className="size-4" />
                    <span className="text-xs font-black uppercase">
                      {nextLocale}
                    </span>
                  </Button>
                }
              />
              <TooltipContent>{t("languageSwitch")}</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      render={
                        <button
                          className="cursor-pointer rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          type="button"
                        >
                          <UserAvatar user={user} />
                        </button>
                      }
                    />
                  }
                />
                <TooltipContent>{user.name}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={8}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex flex-col items-start gap-0">
                    <span className="text-sm font-semibold">{user.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {user.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="size-4" />
                    {t("logout")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}

function getNotificationTitle(notification: Notification): string {
  if (
    typeof notification.data === "object" &&
    notification.data !== null &&
    "title" in notification.data &&
    typeof notification.data.title === "string"
  ) {
    return notification.data.title;
  }

  return notification.type;
}

function getNotificationBody(notification: Notification): string {
  if (
    typeof notification.data === "object" &&
    notification.data !== null &&
    "body" in notification.data &&
    typeof notification.data.body === "string"
  ) {
    return notification.data.body;
  }

  return "";
}
