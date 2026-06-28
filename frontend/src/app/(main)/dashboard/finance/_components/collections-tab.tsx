import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import type { FinanceDashboardData, FinanceUpcomingItem } from "./data";

export function CollectionsTab({
  totals,
  upcoming,
}: {
  totals: FinanceDashboardData["totals"];
  upcoming: FinanceDashboardData["upcoming"];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-8">
        <CardHeader>
          <CardTitle className="font-normal">Outstanding member balances</CardTitle>
          <CardDescription>
            {totals.outstanding_dues_count} balances ·{" "}
            {formatCurrency(Number(totals.outstanding_dues), { currency: "EGP", noDecimals: true })} total due
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinanceItemsTable emptyText="No outstanding member balances." items={upcoming.dues} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:col-span-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-normal">Pending payroll</CardTitle>
            <CardDescription>
              {formatCurrency(Number(totals.pending_payroll), { currency: "EGP", noDecimals: true })} not paid yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FinanceItemsTable compact emptyText="No pending payroll." items={upcoming.pending_payroll} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal">Recent expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <FinanceItemsTable compact emptyText="No recent expenses." items={upcoming.recent_expenses} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FinanceItemsTable({
  compact = false,
  emptyText,
  items,
}: {
  compact?: boolean;
  emptyText: string;
  items: FinanceUpcomingItem[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{compact ? "Item" : "Name"}</TableHead>
          {!compact ? <TableHead>Detail</TableHead> : null}
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length > 0 ? (
          items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.title}</TableCell>
              {!compact ? <TableCell className="text-muted-foreground">{item.description}</TableCell> : null}
              <TableCell className="text-right">
                {formatCurrency(Number(item.amount), { currency: "EGP", noDecimals: true })}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell className="h-20 text-center text-muted-foreground" colSpan={compact ? 2 : 3}>
              {emptyText}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
