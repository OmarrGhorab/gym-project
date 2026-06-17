"use client";

import Image from "next/image";
import {
  BarChart3,
  CreditCard,
  Dumbbell,
  Home,
  Settings,
  UserCheck,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { DashboardNavItem, DashboardRole } from "@/components/dashboard/types";

const icons = {
  BarChart3,
  CreditCard,
  Dumbbell,
  Home,
  Settings,
  UserCheck,
  Users,
};

export function DashboardSidebar({
  className,
  navItems,
  onNavigate,
  userRole,
}: {
  className?: string;
  navItems: DashboardNavItem[];
  onNavigate?: () => void;
  userRole: DashboardRole;
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("DashboardShell");
  const isArabic = locale === "ar";

  return (
    <aside
      className={cn(
        "min-h-screen w-64 shrink-0 bg-sidebar text-sidebar-foreground",
        isArabic
          ? "border-s border-sidebar-border"
          : "border-e border-sidebar-border",
        className
      )}
    >
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <Image
            src="/logo-noBG.png"
            alt="ATP Gym"
            width={56}
            height={56}
            className="h-12 w-12 rounded-lg object-contain"
            priority
          />
          <div>
            <p className="text-sm font-black leading-tight">ATP Gym</p>
            <p className="text-xs font-semibold text-sidebar-foreground/55">
              {t("sidebarSubtitle")}
            </p>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-5">
          {navItems.map((group) => (
            <div
              key={group.sectionKey}
              className={cn("space-y-1", group.sectionKey === "overview" && "pt-3")}
            >
              <p className="px-3 text-xs font-bold text-sidebar-foreground/35">
                {t(`navSections.${group.sectionKey}`)}
              </p>
              {group.items
                .filter((item) => item.roles.includes(userRole))
                .map((item) => {
                  const Icon = icons[item.icon];
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      locale={locale}
                      onClick={onNavigate}
                      className={cn(
                        "flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-bold transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/62 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                      <span>{t(`nav.${item.labelKey}`)}</span>
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
