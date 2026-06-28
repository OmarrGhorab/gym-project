import { Banknote, CreditCard, Landmark } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";

import type { FinanceMoneySource } from "./data";

const methodIcons = {
  bank_transfer: Landmark,
  card: CreditCard,
  cash: Banknote,
} as const;

export function Wallet({ methods }: { methods: FinanceMoneySource[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Payment Channels</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          {methods.map((method) => {
            const Icon = methodIcons[method.key as keyof typeof methodIcons] ?? Banknote;

            return (
              <div key={method.key} className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground text-sm leading-none">{method.label}</span>
                  <span className="font-normal text-muted-foreground text-xs">
                    {Number(method.percentage).toFixed(1)}% of collected payments
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm tabular-nums">
                    {formatCurrency(Number(method.amount), { currency: "EGP", noDecimals: true })}
                  </span>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
                    <Icon className="size-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <span className="font-medium text-[10px] text-muted-foreground">
            Source: <span className="text-foreground">Paid payment records</span>
          </span>
          <div className="flex items-center gap-1.5">
            <div className="size-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            <span className="font-bold text-[9px] text-green-500 uppercase tracking-widest">Live</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
