"use client";

import Link from "next/link";

import { Bell, Dumbbell, LogOut, Settings, ShieldCheck, UsersRound } from "lucide-react";
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
import { logoutAction } from "@/lib/actions/logout";
import { canAccessRoute } from "@/lib/authorization";
import type { DashboardUser } from "@/lib/session";
import { cn, getInitials } from "@/lib/utils";

export function AccountSwitcher({ user }: { readonly user: DashboardUser }) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  const t = useTranslations("Dashboard.account");
  const navigationItems = [
    { href: "/dashboard/settings", icon: Settings, key: "profile-security", label: t("profileSecurity") },
    { href: "/dashboard/settings", icon: Dumbbell, key: "gym-settings", label: t("gymSettings") },
    { href: "/dashboard/users", icon: ShieldCheck, key: "users-roles", label: t("usersRoles") },
    { href: "/dashboard/academy", icon: UsersRound, key: "staff", label: t("staff") },
    { href: "/dashboard/mail", icon: Bell, key: "notifications", label: t("notificationCenter") },
  ].filter((item) => canAccessRoute(user, item.href));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger nativeButton={false} render={<Avatar className="size-9 rounded-lg" />}>
        <AvatarImage src={user.avatar || undefined} alt={user.name} />
        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 space-y-1 rounded-lg" side="bottom" align="end" sideOffset={4}>
        <DropdownMenuItem className={cn("p-0", "bg-accent/50")} aria-current="true">
          <div className={cn("flex w-full items-center gap-2 px-1 py-1.5", isRtl && "flex-row-reverse text-right")}>
            <Avatar className="size-9 rounded-lg">
              <AvatarImage src={user.avatar || undefined} alt={user.name} />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className={cn("grid min-w-0 flex-1 text-sm leading-tight", isRtl ? "text-right" : "text-left")}>
              <span className="truncate font-semibold">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
              <span className="truncate text-muted-foreground text-xs capitalize">{user.role}</span>
            </div>
          </div>
        </DropdownMenuItem>
        {navigationItems.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {navigationItems.map(({ href, icon: Icon, key, label }) => (
                <DropdownMenuItem key={key} render={<Link href={href} />}>
                  <Icon />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <form action={logoutAction}>
          <DropdownMenuItem nativeButton render={<button type="submit" className="w-full" />}>
            <LogOut />
            {t("logout")}
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
