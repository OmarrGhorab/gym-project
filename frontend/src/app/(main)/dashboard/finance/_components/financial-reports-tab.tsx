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
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <CardHeader>
          <CardTitle className="font-normal">Year-to-date summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ReportMetric label="Revenue MTD" value={totals.revenue_mtd} />
          <ReportMetric label="Expenses MTD" value={totals.expenses_mtd} />
          <ReportMetric label="Net profit MTD" value={totals.net_profit_mtd} />
          <ReportMetric label="Profit margin" value={`${Number(totals.profit_margin).toFixed(1)}%`} plain />
        </CardContent>
      </Card>

      <Card className="xl:col-span-8">
        <CardHeader>
          <CardTitle className="font-normal">Monthly financial report</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Expenses</TableHead>
                <TableHead className="text-right">Net profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chart.map((row) => (
                <TableRow key={row.period}>
                  <TableCell>{row.period}</TableCell>
                  <TableCell>{formatCurrency(Number(row.revenue), { currency: "EGP", noDecimals: true })}</TableCell>
                  <TableCell>{formatCurrency(Number(row.expenses), { currency: "EGP", noDecimals: true })}</TableCell>
                  <TableCell className="text-right">
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
