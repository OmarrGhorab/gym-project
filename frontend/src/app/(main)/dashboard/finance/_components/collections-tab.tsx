import { useLocale, useTranslations } from "next-intl";

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
  const t = useTranslations("Dashboard.finance");
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-8">
        <CardHeader>
          <CardTitle className="font-normal">{t("outstandingMemberBalances")}</CardTitle>
          <CardDescription>
            {t("balancesTotalDue", {
              count: numberFormatter.format(totals.outstanding_dues_count),
              total: formatCurrency(Number(totals.outstanding_dues), { currency: "EGP", noDecimals: true }),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinanceItemsTable emptyText={t("noOutstandingMemberBalances")} items={upcoming.dues} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:col-span-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-normal">{t("pendingPayroll")}</CardTitle>
            <CardDescription>
              {t("notPaidYet", {
                value: formatCurrency(Number(totals.pending_payroll), { currency: "EGP", noDecimals: true }),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FinanceItemsTable compact emptyText={t("noPendingPayroll")} items={upcoming.pending_payroll} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal">{t("recentExpenses")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FinanceItemsTable compact emptyText={t("noRecentExpenses")} items={upcoming.recent_expenses} />
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
  const t = useTranslations("Dashboard.finance");

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{compact ? t("item") : t("name")}</TableHead>
          {!compact ? <TableHead>{t("detail")}</TableHead> : null}
          <TableHead className="text-end">{t("amount")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length > 0 ? (
          items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.title}</TableCell>
              {!compact ? <TableCell className="text-muted-foreground">{item.description}</TableCell> : null}
              <TableCell className="text-end">
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
