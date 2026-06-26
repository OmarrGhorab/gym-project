"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import type { DashboardNavItem, DashboardUser } from "@/components/dashboard/types";
import { cn } from "@/lib/utils";

const navItems: DashboardNavItem[] = [
  {
    sectionKey: "overview",
    items: [{ href: "/", icon: "Home", labelKey: "dashboard", roles: ["owner", "admin", "staff"] }],
  },
  {
    sectionKey: "operations",
    items: [
      { href: "/members", icon: "Users", labelKey: "members", roles: ["owner", "admin", "staff"] },
      { href: "/plans", icon: "ClipboardList", labelKey: "plans", roles: ["owner", "admin"] },
      { href: "/subscriptions", icon: "CreditCard", labelKey: "subscriptions", roles: ["owner", "admin"] },
      { href: "/teams", icon: "Dumbbell", labelKey: "teams", roles: ["owner", "admin"] },
      { href: "/trainers", icon: "Users", labelKey: "trainers", roles: ["owner", "admin"] },
      { href: "/attendance", icon: "CalendarCheck2", labelKey: "attendance", roles: ["owner", "admin"] },
      { href: "/products", icon: "Package", labelKey: "products", roles: ["owner", "admin", "staff"] },
      { href: "/pos", icon: "ShoppingCart", labelKey: "pos", roles: ["owner", "admin", "staff"] },
      { href: "/sales", icon: "ReceiptText", labelKey: "sales", roles: ["owner", "admin", "staff"] },
      { href: "/roles", icon: "ShieldCheck", labelKey: "roles", roles: ["owner", "admin"], permissions: ["roles.manage"] },
    ],
  },
  {
    sectionKey: "finance",
    items: [
      { href: "/payments", icon: "CreditCard", labelKey: "payments", roles: ["owner", "admin"], permissions: ["payments.view"] },
      { href: "/expenses", icon: "ReceiptText", labelKey: "expenses", roles: ["owner", "admin"], permissions: ["expenses.view"] },
      { href: "/payroll", icon: "CreditCard", labelKey: "payroll", roles: ["owner", "admin"], permissions: ["payroll.view"] },
      { href: "/commissions", icon: "Percent", labelKey: "commissions", roles: ["owner", "admin"], permissions: ["commissions.view"] },
      { href: "/reports", icon: "BarChart3", labelKey: "reports", roles: ["owner", "admin"], permissions: ["reports.view"] },
      { href: "/exports", icon: "Download", labelKey: "exports", roles: ["owner", "admin"], permissions: ["export.reports"] },
    ],
  },
  {
    sectionKey: "admin",
    items: [
      { href: "/notifications", icon: "Bell", labelKey: "notifications", roles: ["owner", "admin", "staff"], permissions: ["notifications.view"] },
      { href: "/audit", icon: "ClipboardList", labelKey: "audit", roles: ["owner", "admin"], permissions: ["audit.view"] },
      { href: "/settings", icon: "Settings", labelKey: "settings", roles: ["owner"] },
    ],
  },
];

const fallbackUser: DashboardUser = {
  name: "ATP Admin",
  email: "admin@atpgym.local",
  role: "owner",
};

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: DashboardUser | null;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const locale = useLocale();
  const t = useTranslations("DashboardShell");
  const dashboardUser = user ?? fallbackUser;
  const isArabic = locale === "ar";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="min-h-screen">
        <DashboardSidebar
          className={cn(
            "fixed inset-y-0 z-40 hidden lg:block",
            isArabic ? "right-0" : "left-0"
          )}
          navItems={navItems}
          onNavigate={() => setIsMobileSidebarOpen(false)}
          userRole={dashboardUser.role}
          userPermissions={dashboardUser.permissions ?? []}
        />

        <div
          className={cn(
            "fixed inset-0 z-40 bg-foreground/35 backdrop-blur-sm transition-opacity lg:hidden",
            isMobileSidebarOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          )}
          aria-hidden="true"
          onClick={() => setIsMobileSidebarOpen(false)}
        />

        <DashboardSidebar
          className={cn(
            "fixed inset-y-0 z-50 shadow-2xl transition-transform duration-200 lg:hidden",
            isArabic ? "right-0" : "left-0",
            isMobileSidebarOpen
              ? "translate-x-0"
              : isArabic
                ? "translate-x-full"
                : "-translate-x-full"
          )}
          navItems={navItems}
          onNavigate={() => setIsMobileSidebarOpen(false)}
          userRole={dashboardUser.role}
          userPermissions={dashboardUser.permissions ?? []}
        />

        <section className="min-w-0 flex-1">
          <div className={cn(isArabic ? "lg:pr-64" : "lg:pl-64")}>
            <DashboardNavbar
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
              user={dashboardUser}
            />
            <main aria-label={t("mainContent")}>{children}</main>
          </div>
        </section>
      </div>
    </div>
  );
}
