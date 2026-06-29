import { Banknote, Download, FileText, HandCoins, ReceiptText, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const shortcuts = [
  { id: 1, labelKey: "recordExpense", icon: ReceiptText },
  { id: 2, labelKey: "collectDue", icon: HandCoins },
  { id: 3, labelKey: "salesReport", icon: FileText },
  { id: 4, labelKey: "payroll", icon: UsersRound },
  { id: 5, labelKey: "payments", icon: Banknote },
  { id: 6, labelKey: "export", icon: Download },
] as const;

export function QuickActions() {
  const t = useTranslations("Dashboard.finance");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">{t("financeActions")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {shortcuts.map((shortcut) => {
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
