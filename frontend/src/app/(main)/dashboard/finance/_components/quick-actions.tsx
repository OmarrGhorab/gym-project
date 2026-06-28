import { Banknote, Download, FileText, HandCoins, ReceiptText, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const shortcuts = [
  { id: 1, label: "Record expense", icon: ReceiptText },
  { id: 2, label: "Collect due", icon: HandCoins },
  { id: 3, label: "Sales report", icon: FileText },
  { id: 4, label: "Payroll", icon: UsersRound },
  { id: 5, label: "Payments", icon: Banknote },
  { id: 6, label: "Export", icon: Download },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Finance Actions</CardTitle>
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
                <span className="text-center text-muted-foreground text-xs">{shortcut.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
