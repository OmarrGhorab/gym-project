import { Suspense } from "react";

import { format as formatDateFns, subDays } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BalanceDistributionCard } from "./_components/balance-distribution-card";
import { getFinanceDashboardData } from "./_components/data";
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
  const { from, to, group_by } = await searchParams;
  const resolvedFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : defaultFrom();
  const resolvedTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : defaultTo();
  const groupBy = group_by === "day" ? "day" : "month";
  const data = await getFinanceDashboardData(resolvedFrom, resolvedTo, groupBy);
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
            <TabsTrigger value="ledger">{t("tabs.ledger")}</TabsTrigger>
          </TabsList>

          <FinanceToolbarActions
            updatedAt={new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date())}
          />
        </div>

        <TabsContent value="30-days" className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <OverviewKpis totals={data.totals} />
            </div>

            <div className="flex flex-col gap-4 xl:col-span-6">
              <IncomeBreakdown sources={data.revenue_sources} />
              <FinanceNotification totals={data.totals} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <Suspense fallback={null}>
                <TransactionsOverviewCard chart={data.chart} />
              </Suspense>
            </div>
            <div className="xl:col-span-5">
              <BalanceDistributionCard methods={data.payment_methods} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <Wallet methods={data.payment_methods} />
            </div>
            <div className="xl:col-span-4">
              <UpcomingTransactions upcoming={data.upcoming} totals={data.totals} />
            </div>
            <div className="xl:col-span-4">
              <QuickActions />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ledger">
          <LedgerTab dues={data.duesLedger} expenses={data.expensesLedger} payments={data.paymentsLedger} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
