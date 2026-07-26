import { Banknote, Download, FileText, HandCoins, ReceiptText, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Same deep-link contract as the dashboard quick shortcuts: `?action=…` opens the modal on
// arrival, `?tab=ledger#…` jumps to the matching ledger section.
const shortcuts = [
  {
    id: 1,
    href: "/dashboard/finance?action=record-expense",
    labelKey: "recordExpense",
    icon: ReceiptText,
    permission: "canRecordExpense",
  },
  {
    id: 2,
    href: "/dashboard/finance?tab=ledger#outstanding-dues",
    labelKey: "collectDue",
    icon: HandCoins,
    permission: "canCollectDue",
  },
  {
    id: 3,
    href: "/dashboard/reports?type=products_finance",
    labelKey: "salesReport",
    icon: FileText,
    permission: "canViewReports",
  },
  { id: 4, href: "/dashboard/payroll", labelKey: "payroll", icon: UsersRound, permission: "canViewPayroll" },
  {
    id: 5,
    href: "/dashboard/finance?tab=ledger#recent-payments",
    labelKey: "payments",
    icon: Banknote,
    permission: "canViewPayments",
  },
  { id: 6, href: "/dashboard/finance?action=export", labelKey: "export", icon: Download, permission: "canExport" },
] as const;

type QuickActionPermissions = Record<(typeof shortcuts)[number]["permission"], boolean>;

export function QuickActions({ permissions }: { permissions: QuickActionPermissions }) {
  const t = useTranslations("Dashboard.finance");
  const visibleShortcuts = shortcuts.filter((shortcut) => permissions[shortcut.permission]);

  if (visibleShortcuts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">{t("financeActions")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {visibleShortcuts.map((shortcut) => {
            const Icon = shortcut.icon;
            const label = t(`actions.${shortcut.labelKey}`);

            return (
              <div key={shortcut.id} className="flex flex-col items-center gap-2.5">
                <Button
                  nativeButton={false}
                  render={<a href={shortcut.href} />}
                  variant="outline"
                  className="size-12 rounded-full"
                  aria-label={label}
                >
                  <Icon className="size-5" />
                </Button>
                <span className="text-center text-muted-foreground text-xs">{label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
