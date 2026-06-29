import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          <ReportMetric label={t("revenueMtd")} value={totals.revenue_mtd} />
          <ReportMetric label={t("expensesMtd")} value={totals.expenses_mtd} />
          <ReportMetric label={t("netProfitMtd")} value={totals.net_profit_mtd} />
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
                  <TableCell>{formatCurrency(Number(row.revenue), { currency: "EGP", noDecimals: true })}</TableCell>
                  <TableCell>{formatCurrency(Number(row.expenses), { currency: "EGP", noDecimals: true })}</TableCell>
                  <TableCell className="text-end">
                    {formatCurrency(Number(row.net_profit), { currency: "EGP", noDecimals: true })}
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

function ReportMetric({ label, value, plain = false }: { label: string; value: string; plain?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-medium tabular-nums">
        {plain ? value : formatCurrency(Number(value), { currency: "EGP", noDecimals: true })}
      </span>
    </div>
  );
}
