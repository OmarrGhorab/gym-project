"use client";

import { Bell, Dumbbell, LogOut, Settings, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

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
import type { DashboardUser } from "@/lib/session";
import { cn, getInitials } from "@/lib/utils";

export function AccountSwitcher({ user }: { readonly user: DashboardUser }) {
  const t = useTranslations("Dashboard.account");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger nativeButton={false} render={<Avatar className="size-9 rounded-lg" />}>
        <AvatarImage src={user.avatar || undefined} alt={user.name} />
        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 space-y-1 rounded-lg" side="bottom" align="end" sideOffset={4}>
        <DropdownMenuItem className={cn("p-0", "bg-accent/50")} aria-current="true">
          <div className="flex w-full items-center gap-2 px-1 py-1.5">
            <Avatar className="size-9 rounded-lg">
              <AvatarImage src={user.avatar || undefined} alt={user.name} />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
              <span className="truncate text-muted-foreground text-xs capitalize">{user.role}</span>
            </div>
          </div>
        </DropdownMenuItem>
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
  );
}
