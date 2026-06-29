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

const shortcuts = [
  { href: "/dashboard/members", labelKey: "addMember", icon: UserPlus },
  { href: "/dashboard/attendance", labelKey: "attendance", icon: ClipboardCheck },
  { href: "/dashboard/ecommerce", labelKey: "posCheckout", icon: ShoppingCart },
  { href: "/dashboard/logistics", labelKey: "products", icon: PackageCheck },
  { href: "/dashboard/finance", labelKey: "recordExpense", icon: ReceiptText },
  { href: "/dashboard/finance", labelKey: "collectDue", icon: HandCoins },
  { href: "/dashboard/ecommerce", labelKey: "salesReport", icon: FileText },
  { href: "/dashboard/payroll", labelKey: "payroll", icon: UsersRound },
  { href: "/dashboard/finance", labelKey: "payments", icon: Banknote },
  { href: "/api/finance/export", labelKey: "export", icon: Download },
  { href: "/dashboard/calendar", labelKey: "schedule", icon: CalendarDays },
  { href: "/dashboard/tasks", labelKey: "tasks", icon: ClipboardCheck },
  { href: "/dashboard/academy", labelKey: "staff", icon: UsersRound },
  { href: "/dashboard/plans", labelKey: "plans", icon: PackageCheck },
  { href: "/dashboard/users", labelKey: "users", icon: ShieldCheck },
  { href: "/dashboard/settings", labelKey: "settings", icon: Settings },
] as const;

export async function DashboardShortcuts() {
  const t = await getTranslations("Dashboard.default");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">{t("shortcuts.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-8">
          {shortcuts.map((shortcut) => {
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
