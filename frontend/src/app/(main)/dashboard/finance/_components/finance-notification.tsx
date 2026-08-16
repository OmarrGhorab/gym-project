import { TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { Money } from "@/components/money/money";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { MONEY_REDACTED } from "@/lib/money-visibility";
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
          {/* Only the figure is withheld — the standing itself still reads sensibly without it. */}
          <Money
            domain="payments"
            redacted={t("positionDescription", { dues: MONEY_REDACTED, margin: margin.toFixed(1) })}
          >
            {t("positionDescription", {
              dues: formatCurrency(dues, { currency: "EGP", noDecimals: true }),
              margin: margin.toFixed(1),
            })}
          </Money>
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
