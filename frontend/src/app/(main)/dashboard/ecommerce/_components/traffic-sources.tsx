"use client";

import { ArrowUpRight, Banknote, CreditCard, Landmark } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { PosPaymentMethod } from "./data";
import { usePosMoney } from "./format";

const icons = {
  bank_transfer: Landmark,
  card: CreditCard,
  cash: Banknote,
} as const;

export function TrafficSources({ methods }: { methods: PosPaymentMethod[] }) {
  const t = useTranslations("Dashboard.ecommerce");
  const posMoney = usePosMoney();
  const total = methods.reduce((sum, method) => sum + method.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">{t("paymentMethods")}</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {t("paidOrders", { count: total })}
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="grid h-60 content-center gap-6">
          {methods.map((method) => {
            const Icon = icons[method.method as keyof typeof icons] ?? Banknote;
            const share = Number(method.percentage);

            return (
              <div className="grid gap-1.5" key={method.method}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium text-[13px]">{method.label}</span>
                  </div>
                  <span className="text-[13px] text-green-700 tabular-nums dark:text-green-300">
                    {method.percentage}%
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-lg bg-muted">
                  <div
                    className="h-full rounded-lg bg-foreground/50"
                    style={{ width: `${Math.min(Math.max(share, 0), 100)}%` }}
                  />
                </div>
                <div className="text-muted-foreground text-xs tabular-nums">
                  {posMoney(method.amount)} · {t("ordersCount", { count: method.count })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
