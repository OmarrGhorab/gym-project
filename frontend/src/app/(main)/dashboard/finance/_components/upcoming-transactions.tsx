import { ChevronRight, CircleDollarSign, ReceiptText, Zap } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { formatCurrency } from "@/lib/utils";

import type { FinanceDashboardData, FinanceUpcomingItem } from "./data";

export function UpcomingTransactions({
  totals,
  upcoming,
}: {
  totals: FinanceDashboardData["totals"];
  upcoming: FinanceDashboardData["upcoming"];
}) {
  const items: Array<FinanceUpcomingItem & { kind: "due" | "expense" | "payroll" }> = [
    ...upcoming.dues.map((item) => ({ ...item, kind: "due" as const })),
    ...upcoming.pending_payroll.map((item) => ({ ...item, kind: "payroll" as const })),
    ...upcoming.recent_expenses.map((item) => ({ ...item, kind: "expense" as const })),
  ].slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Collections & Obligations</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-baseline text-3xl leading-none tracking-tight">
              <span className="font-normal">
                {formatCurrency(Number(totals.outstanding_dues), { currency: "EGP", noDecimals: true })}
              </span>
            </h2>
            <p className="text-muted-foreground text-sm leading-none">
              <span className="font-medium text-foreground">{totals.outstanding_dues_count}</span> balances need
              collection
            </p>
          </div>
          <div className="flex w-max items-center gap-2 rounded-md border border-border bg-muted/70 px-2 py-1.5 text-sm">
            <Zap className="size-4 fill-primary text-primary" />
            <span className="text-muted-foreground">
              Pending payroll:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(Number(totals.pending_payroll), { currency: "EGP", noDecimals: true })}
              </span>
            </span>
          </div>
        </div>

        <ItemGroup>
          {items.length > 0 ? (
            items.map((item) => <FinanceItem item={item} key={`${item.kind}-${item.id}`} />)
          ) : (
            <Item variant="outline" size="xs">
              <ItemContent>
                <ItemTitle>No open finance follow-ups</ItemTitle>
                <ItemDescription>Collections, payroll, and expenses are clear.</ItemDescription>
              </ItemContent>
            </Item>
          )}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

function FinanceItem({ item }: { item: FinanceUpcomingItem & { kind: "due" | "expense" | "payroll" } }) {
  const Icon = item.kind === "expense" ? ReceiptText : CircleDollarSign;

  return (
    <Item variant="outline" size="xs">
      <ItemMedia>
        <div className="grid size-9 place-items-center rounded-md border bg-background">
          <Icon className="size-4" />
        </div>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{item.title}</ItemTitle>
        <ItemDescription>
          {item.description} · {formatCurrency(Number(item.amount), { currency: "EGP", noDecimals: true })}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <ChevronRight className="size-5 text-muted-foreground" />
      </ItemActions>
    </Item>
  );
}
