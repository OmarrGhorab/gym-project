import { Banknote, Download, FileText, HandCoins, ReceiptText, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const shortcuts = [
  { id: 1, labelKey: "recordExpense", icon: ReceiptText, permission: "recordExpense" },
  { id: 2, labelKey: "collectDue", icon: HandCoins, permission: "payments" },
  { id: 3, labelKey: "salesReport", icon: FileText, permission: "reports" },
  { id: 4, labelKey: "payroll", icon: UsersRound, permission: "payroll" },
  { id: 5, labelKey: "payments", icon: Banknote, permission: "payments" },
  { id: 6, labelKey: "export", icon: Download, permission: "export" },
] as const;

export function QuickActions({ canExport, canRecordExpense }: { canExport: boolean; canRecordExpense: boolean }) {
  const t = useTranslations("Dashboard.finance");
  const visibleShortcuts = shortcuts.filter((shortcut) => {
    if (shortcut.permission === "recordExpense") {
      return canRecordExpense;
    }

    if (shortcut.permission === "export") {
      return canExport;
    }

    return false;
  });

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
            return (
              <div key={shortcut.id} className="flex flex-col items-center gap-2.5">
                <Button variant="outline" className="size-12 rounded-full">
                  <Icon className="size-5" />
                </Button>
                <span className="text-center text-muted-foreground text-xs">{t(`actions.${shortcut.labelKey}`)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
