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
import { canAccess } from "@/lib/authorization";
import type { DashboardUser } from "@/lib/session";
import { getCurrentUser } from "@/lib/session";

const shortcuts = [
  { href: "/dashboard/members", labelKey: "addMember", icon: UserPlus, permission: "members.create" },
  { href: "/dashboard/attendance", labelKey: "attendance", icon: ClipboardCheck, permission: "attendance.view" },
  { href: "/dashboard/ecommerce", labelKey: "posCheckout", icon: ShoppingCart, permission: "sales.view" },
  { href: "/dashboard/logistics", labelKey: "products", icon: PackageCheck, permission: "products.view" },
  { href: "/dashboard/logistics", labelKey: "recordExpense", icon: ReceiptText, permission: "expenses.create" },
  { href: "/dashboard/finance", labelKey: "collectDue", icon: HandCoins, permission: "reports.view" },
  { href: "/dashboard/ecommerce", labelKey: "salesReport", icon: FileText, permission: "sales.view" },
  { href: "/dashboard/payroll", labelKey: "payroll", icon: UsersRound, permission: "payroll.view" },
  { href: "/dashboard/finance", labelKey: "payments", icon: Banknote, permission: "reports.view" },
  { href: "/api/finance/export", labelKey: "export", icon: Download, permission: "export.reports" },
  { href: "/dashboard/calendar", labelKey: "schedule", icon: CalendarDays, permission: "reports.view" },
  { href: "/dashboard/tasks", labelKey: "tasks", icon: ClipboardCheck, permission: "reports.view" },
  { href: "/dashboard/academy", labelKey: "staff", icon: UsersRound, permission: "employees.view" },
  { href: "/dashboard/plans", labelKey: "plans", icon: PackageCheck, permission: "plans.view" },
  { href: "/dashboard/users", labelKey: "users", icon: ShieldCheck, permission: "roles.manage" },
  { href: "/dashboard/settings", labelKey: "settings", icon: Settings, permission: "settings.manage" },
] as const;

export async function DashboardShortcuts() {
  const t = await getTranslations("Dashboard.default");
  const user = await getCurrentUser();
  const visibleShortcuts = user ? shortcuts.filter((shortcut) => canShowShortcut(user, shortcut.permission)) : [];

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

function canShowShortcut(user: Pick<DashboardUser, "permissions">, permission?: string) {
  return permission ? canAccess(user, permission) : true;
}
