import { TrendingDown, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { formatCurrency } from "@/lib/utils";

import type { FinanceDashboardData } from "./data";

export function FinanceNotification({ totals }: { totals: FinanceDashboardData["totals"] }) {
  const dues = Number(totals.outstanding_dues);
  const profit = Number(totals.net_profit_mtd);
  const margin = Number(totals.profit_margin);
  const Icon = profit >= 0 ? TrendingUp : TrendingDown;

  return (
    <Item className="rounded-xl" variant="outline">
      <ItemMedia variant="icon">
        <Icon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{profit >= 0 ? "Finance position is positive" : "Finance position needs attention"}</ItemTitle>
        <ItemDescription>
          {formatCurrency(dues, { currency: "EGP", noDecimals: true })} outstanding dues · {margin.toFixed(1)}% margin
          this month.
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline">
          View dues
        </Button>
      </ItemActions>
    </Item>
  );
}
