import type { ReactNode } from "react";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { defaultLocale, getLocaleDirection, isAppLocale, localeCookieName } from "@/i18n/config";
import { canAccessRoute, firstAccessibleDashboardPath } from "@/lib/authorization";
import { SIDEBAR_COLLAPSIBLE_VALUES, SIDEBAR_VARIANT_VALUES } from "@/lib/preferences/layout";
import { getCurrentUser, requireAuth } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getPreference } from "@/server/server-actions";

import { AccountSwitcher } from "./_components/sidebar/account-switcher";
import { LayoutControls } from "./_components/sidebar/layout-controls";
import { LocaleSwitchOverlay } from "./_components/sidebar/locale-switch-overlay";
import { NotificationMenu } from "./_components/sidebar/notification-menu";
import { SearchDialog } from "./_components/sidebar/search-dialog";
import { ThemeSwitcher } from "./_components/sidebar/theme-switcher";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  await requireAuth();
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const cookieStore = await cookies();
  const headerStore = await headers();
  const pathname = headerStore.get("x-dashboard-pathname") ?? "/dashboard/default";
  const canViewCurrentRoute = canAccessRoute(user, pathname);
  const fallbackPath = firstAccessibleDashboardPath(user);
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale = isAppLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const sidebarSide = getLocaleDirection(locale) === "rtl" ? "right" : "left";

  if (!canViewCurrentRoute) {
    redirect(fallbackPath === "/dashboard/[...not-found]" ? "/unauthorized" : fallbackPath);
  }

  const [variant, collapsible] = await Promise.all([
    getPreference("sidebar_variant", SIDEBAR_VARIANT_VALUES, "inset"),
    getPreference("sidebar_collapsible", SIDEBAR_COLLAPSIBLE_VALUES, "icon"),
  ]);

  return (
    <SidebarProvider
      className="h-svh min-h-0 overflow-hidden"
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={user} side={sidebarSide} variant={variant} collapsible={collapsible} />
      <LocaleSwitchOverlay />
      <SidebarInset
        className={cn(
          "[html[data-content-layout=centered]_&>*]:mx-auto",
          "[html[data-content-layout=centered]_&>*]:w-full",
          "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
          "peer-data-[variant=inset]:border",
          "[--dashboard-header-height:--spacing(12)]",
          "min-h-0 min-w-0 overflow-hidden",
        )}
      >
        <header
          className={cn(
            "sticky top-0 z-50 flex h-12 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
            "[html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/80 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
          )}
        >
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ms-1" />
              <Separator
                orientation="vertical"
                className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
              />
              <SearchDialog user={user} />
            </div>
            <div className="flex items-center gap-2">
              <LayoutControls />
              <NotificationMenu />
              <ThemeSwitcher />
              <AccountSwitcher user={user} />
            </div>
          </div>
        </header>
        {/* Pages can set data-content-padding="false" to render full-bleed app layouts. */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
