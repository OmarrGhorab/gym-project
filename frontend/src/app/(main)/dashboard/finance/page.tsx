import { Suspense } from "react";

import { format as formatDateFns, subDays } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";

import { BalanceDistributionCard } from "./_components/balance-distribution-card";
import { getFinanceDashboardData } from "./_components/data";
import { FinanceFilters } from "./_components/finance-filters";
import { FinanceNotification } from "./_components/finance-notification";
import { FinanceToolbarActions } from "./_components/finance-toolbar-actions";
import { IncomeBreakdown } from "./_components/income-breakdown";
import { LedgerTab } from "./_components/ledger-tab";
import { OverviewKpis } from "./_components/overview-kpis";
import { QuickActions } from "./_components/quick-actions";
import { TransactionsOverviewCard } from "./_components/transactions-overview-card";
import { UpcomingTransactions } from "./_components/upcoming-transactions";
import { Wallet } from "./_components/wallet";

function defaultFrom() {
  return formatDateFns(subDays(new Date(), 364), "yyyy-MM-dd");
}

function defaultTo() {
  return formatDateFns(new Date(), "yyyy-MM-dd");
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; group_by?: string }>;
}) {
  const t = await getTranslations("Dashboard.finance");
  const locale = await getLocale();
  const user = await getCurrentUser();
  const { from, to, group_by } = await searchParams;
  const resolvedFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : defaultFrom();
  const resolvedTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : defaultTo();
  const groupBy = group_by === "day" ? "day" : "month";
  const data = await getFinanceDashboardData(resolvedFrom, resolvedTo, groupBy);
  const canExportReports = user ? canAccess(user, "export.reports") : false;
  const canRecordExpense = user ? canAccess(user, "expenses.create") : false;
  const hasTotals = hasAnyMoneyValue([
    data.totals.revenue_mtd,
    data.totals.expenses_mtd,
    data.totals.pending_payroll,
    data.totals.outstanding_dues,
    data.totals.net_profit_mtd,
  ]);
  const hasRevenueSources = data.revenue_sources.some((source) => Number(source.amount) > 0);
  const hasChartData = data.chart.some((point) => Number(point.revenue) > 0 || Number(point.expenses) > 0);
  const hasPaymentMethods = data.payment_methods.some((method) => Number(method.amount) > 0);
  const hasUpcoming =
    Number(data.totals.outstanding_dues) > 0 ||
    Number(data.totals.pending_payroll) > 0 ||
    data.upcoming.pending_payroll.length > 0 ||
    data.upcoming.recent_expenses.length > 0;
  const hasLedger = data.duesLedger.length > 0 || data.expensesLedger.length > 0 || data.paymentsLedger.length > 0;
  const formattedDate = new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date());
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{formattedDate}</p>
      </div>

      <Tabs defaultValue="30-days" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList variant="line">
            <TabsTrigger value="30-days">{t("tabs.dashboard")}</TabsTrigger>
            {hasLedger ? <TabsTrigger value="ledger">{t("tabs.ledger")}</TabsTrigger> : null}
          </TabsList>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <FinanceFilters
              defaults={{
                from: resolvedFrom,
                to: resolvedTo,
              }}
            />
            <FinanceToolbarActions
              canExport={canExportReports}
              canRecordExpense={canRecordExpense}
              exportDefaults={{
                from: resolvedFrom,
                groupBy,
                locale,
                to: resolvedTo,
              }}
              updatedAt={new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date())}
            />
          </div>
        </div>

        <TabsContent value="30-days" className="flex flex-col gap-4">
          {hasTotals || hasRevenueSources ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              {hasTotals ? (
                <div className="xl:col-span-6">
                  <OverviewKpis totals={data.totals} />
                </div>
              ) : null}

              {hasRevenueSources || hasTotals ? (
                <div className="flex flex-col gap-4 xl:col-span-6">
                  {hasRevenueSources ? <IncomeBreakdown sources={data.revenue_sources} /> : null}
                  {hasTotals ? <FinanceNotification totals={data.totals} /> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {hasChartData || hasPaymentMethods ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              {hasChartData ? (
                <div className="xl:col-span-7">
                  <Suspense fallback={null}>
                    <TransactionsOverviewCard chart={data.chart} />
                  </Suspense>
                </div>
              ) : null}
              {hasPaymentMethods ? (
                <div className="xl:col-span-5">
                  <BalanceDistributionCard methods={data.payment_methods} />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {hasPaymentMethods ? (
              <div className="xl:col-span-4">
                <Wallet methods={data.payment_methods} />
              </div>
            ) : null}
            {hasUpcoming ? (
              <div className="xl:col-span-4">
                <UpcomingTransactions upcoming={data.upcoming} totals={data.totals} />
              </div>
            ) : null}
            <div className="xl:col-span-4">
              <QuickActions canExport={canExportReports} canRecordExpense={canRecordExpense} />
            </div>
          </div>
        </TabsContent>

        {hasLedger ? (
          <TabsContent value="ledger">
            <LedgerTab dues={data.duesLedger} expenses={data.expensesLedger} payments={data.paymentsLedger} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function hasAnyMoneyValue(values: Array<number | string>) {
  return values.some((value) => Number(value) !== 0);
}
