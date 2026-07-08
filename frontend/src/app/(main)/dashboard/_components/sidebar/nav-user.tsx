"use client";

import Link from "next/link";

import { Bell, Dumbbell, EllipsisVertical, LogOut, Settings, ShieldCheck, UsersRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { logoutAction } from "@/lib/actions/logout";
import type { DashboardUser } from "@/lib/session";
import { cn, getInitials } from "@/lib/utils";

export function NavUser({ user }: { readonly user: DashboardUser }) {
  const { isMobile } = useSidebar();
  const locale = useLocale();
  const isRtl = locale === "ar";
  const t = useTranslations("Dashboard.account");

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar className="h-8 w-8 rounded-lg grayscale">
              <AvatarImage src={user.avatar || undefined} alt={user.name} />
              <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className={cn("grid flex-1 text-sm leading-tight", isRtl ? "text-right" : "text-left")}>
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-muted-foreground text-xs">{user.email}</span>
            </div>
            <EllipsisVertical className={cn("size-4", isRtl ? "mr-auto" : "ml-auto")} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <div className={cn("flex items-center gap-2 px-2 py-1.5 text-sm", isRtl && "flex-row-reverse text-right")}>
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className={cn("grid flex-1 text-sm leading-tight", isRtl ? "text-right" : "text-left")}>
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-muted-foreground text-xs">{user.email}</span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
                <Settings />
                {t("profileSecurity")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
                <Dumbbell />
                {t("gymSettings")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/dashboard/users" />}>
                <ShieldCheck />
                {t("usersRoles")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/dashboard/academy" />}>
                <UsersRound />
                {t("staff")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/dashboard/mail" />}>
                <Bell />
                {t("notificationCenter")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <form action={logoutAction}>
              <DropdownMenuItem nativeButton render={<button type="submit" className="w-full" />}>
                <LogOut />
                {t("logout")}
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
