import {
  Banknote,
  CalendarDays,
  ClipboardCheck,
  Download,
  FileText,
  HandCoins,
  PackageCheck,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canAccess, canAccessRoute } from "@/lib/authorization";
import type { DashboardUser } from "@/lib/session";
import { getCurrentUser } from "@/lib/session";

// Every shortcut deep-links into the actual work instead of dropping the user on a bare page:
// `?action=…` opens the matching modal on arrival (see `useQueryDialog`), while `?tab=…` and
// `#anchor` land on the right section. Shortcuts are hidden unless the user can both reach the
// destination route and perform the action there.
const shortcuts = [
  {
    href: "/dashboard/members?create=member",
    labelKey: "addMember",
    icon: UserPlus,
    permission: "members.create",
  },
  {
    href: "/dashboard/attendance#attendance-actions",
    labelKey: "attendance",
    icon: ClipboardCheck,
    permission: "attendance.view",
  },
  {
    href: "/dashboard/ecommerce?action=checkout",
    labelKey: "posCheckout",
    icon: ShoppingCart,
    permission: "sales.create",
  },
  {
    href: "/dashboard/logistics?tab=products",
    labelKey: "products",
    icon: PackageCheck,
    permission: "products.view",
  },
  {
    // Recording an expense lives on the logistics page too, which stays reachable for staff who
    // may not hold `reports.view` (the finance page requires it).
    href: "/dashboard/logistics?action=record-expense",
    labelKey: "recordExpense",
    icon: ReceiptText,
    permission: "expenses.create",
  },
  {
    href: "/dashboard/finance?tab=ledger#outstanding-dues",
    labelKey: "collectDue",
    icon: HandCoins,
    permission: "payments.create",
  },
  {
    href: "/dashboard/reports?type=products_finance",
    labelKey: "salesReport",
    icon: FileText,
    permission: "reports.view",
  },
  { href: "/dashboard/payroll", labelKey: "payroll", icon: UsersRound, permission: "payroll.view" },
  {
    href: "/dashboard/finance?tab=ledger#recent-payments",
    labelKey: "payments",
    icon: Banknote,
    permission: "payments.view",
  },
  {
    href: "/dashboard/finance?action=export",
    labelKey: "export",
    icon: Download,
    permission: "export.reports",
  },
  { href: "/dashboard/calendar", labelKey: "schedule", icon: CalendarDays, permission: "reports.view" },
  { href: "/dashboard/tasks", labelKey: "tasks", icon: ClipboardCheck, permission: "reports.view" },
  { href: "/dashboard/academy/staff", labelKey: "staff", icon: UsersRound, permission: "employees.view" },
  { href: "/dashboard/plans", labelKey: "plans", icon: PackageCheck, permission: "plans.view" },
  { href: "/dashboard/users", labelKey: "users", icon: ShieldCheck, permission: "roles.manage" },
  { href: "/dashboard/settings", labelKey: "settings", icon: Settings, permission: "settings.manage" },
] as const;

export async function DashboardShortcuts() {
  const t = await getTranslations("Dashboard.default");
  const user = await getCurrentUser();
  const visibleShortcuts = user ? shortcuts.filter((shortcut) => canShowShortcut(user, shortcut)) : [];

  if (visibleShortcuts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">{t("shortcuts.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-8">
          {visibleShortcuts.map((shortcut) => {
            const Icon = shortcut.icon;

            return (
              <div key={shortcut.labelKey} className="flex flex-col items-center gap-2.5">
                <Button
                  nativeButton={false}
                  render={<a href={shortcut.href} />}
                  variant="outline"
                  className="size-12 rounded-full"
                  aria-label={t(`shortcuts.${shortcut.labelKey}`)}
                >
                  <Icon className="size-5" />
                </Button>
                <span className="text-center text-muted-foreground text-xs">{t(`shortcuts.${shortcut.labelKey}`)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function canShowShortcut(user: Pick<DashboardUser, "permissions">, shortcut: { href: string; permission?: string }) {
  return canAccessRoute(user, toPathname(shortcut.href)) && canAccess(user, shortcut.permission);
}

function toPathname(href: string) {
  return href.split(/[?#]/)[0];
}
