import { TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { formatCurrency } from "@/lib/utils";

import type { FinanceDashboardData } from "./data";

export function FinanceNotification({ totals }: { totals: FinanceDashboardData["totals"] }) {
  const t = useTranslations("Dashboard.finance");
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
        <ItemTitle>{profit >= 0 ? t("positivePosition") : t("attentionPosition")}</ItemTitle>
        <ItemDescription>
          {t("positionDescription", {
            dues: formatCurrency(dues, { currency: "EGP", noDecimals: true }),
            margin: margin.toFixed(1),
          })}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline">
          {t("viewDues")}
        </Button>
      </ItemActions>
    </Item>
  );
}
