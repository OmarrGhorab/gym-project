"use client";

import { Bell, Languages, Menu, Moon, Search, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAppTheme } from "@/components/theme-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/dashboard/user-avatar";
import type { DashboardUser } from "@/components/dashboard/types";

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

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-30 border-b bg-card/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
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

          <div className="hidden min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-muted-foreground shadow-inner md:flex">
            <Search className="size-4 shrink-0" />
            <span className="truncate text-sm">{t("search")}</span>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    className="relative"
                    size="icon-lg"
                    type="button"
                    variant="outline"
                  >
                    <Bell className="size-5" />
                    <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500" />
                  </Button>
                }
              />
              <TooltipContent>{t("notifications")}</TooltipContent>
            </Tooltip>

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

            <UserAvatar user={user} />
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}
