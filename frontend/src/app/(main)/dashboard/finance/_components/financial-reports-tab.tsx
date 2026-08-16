import { useTranslations } from "next-intl";

import { Money } from "@/components/money/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MoneyDomain } from "@/lib/money-visibility";
import { formatCurrency } from "@/lib/utils";

import type { FinanceChartPoint, FinanceDashboardData } from "./data";

export function FinancialReportsTab({
  chart,
  totals,
}: {
  chart: FinanceChartPoint[];
  totals: FinanceDashboardData["totals"];
}) {
  const t = useTranslations("Dashboard.finance");

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <CardHeader>
          <CardTitle className="font-normal">{t("yearToDateSummary")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ReportMetric domain="reports" label={t("revenueMtd")} value={totals.revenue_mtd} />
          <ReportMetric domain="expenses" label={t("expensesMtd")} value={totals.expenses_mtd} />
          <ReportMetric domain="reports" label={t("netProfitMtd")} value={totals.net_profit_mtd} />
          {/* A ratio, not an amount — it survives redaction. */}
          <ReportMetric label={t("profitMargin")} value={`${Number(totals.profit_margin).toFixed(1)}%`} plain />
        </CardContent>
      </Card>

      <Card className="xl:col-span-8">
        <CardHeader>
          <CardTitle className="font-normal">{t("monthlyFinancialReport")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("period")}</TableHead>
                <TableHead>{t("revenue")}</TableHead>
                <TableHead>{t("expenses")}</TableHead>
                <TableHead className="text-end">{t("netProfit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chart.map((row) => (
                <TableRow key={row.period}>
                  <TableCell>{row.period}</TableCell>
                  <TableCell>
                    <Money domain="reports">
                      {formatCurrency(Number(row.revenue), { currency: "EGP", noDecimals: true })}
                    </Money>
                  </TableCell>
                  <TableCell>
                    <Money domain="expenses">
                      {formatCurrency(Number(row.expenses), { currency: "EGP", noDecimals: true })}
                    </Money>
                  </TableCell>
                  <TableCell className="text-end">
                    <Money domain="reports">
                      {formatCurrency(Number(row.net_profit), { currency: "EGP", noDecimals: true })}
                    </Money>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportMetric({
  domain,
  label,
  plain = false,
  value,
}: {
  domain?: MoneyDomain;
  label: string;
  plain?: boolean;
  value: string;
}) {
  if (plain || !domain) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-3">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <Money domain={domain} className="font-medium tabular-nums">
        {formatCurrency(Number(value), { currency: "EGP", noDecimals: true })}
      </Money>
    </div>
  );
}
