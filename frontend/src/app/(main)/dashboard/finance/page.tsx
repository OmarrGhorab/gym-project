import { format } from "date-fns";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BalanceDistributionCard } from "./_components/balance-distribution-card";
import { CollectionsTab } from "./_components/collections-tab";
import { getFinanceDashboardData } from "./_components/data";
import { FinanceNotification } from "./_components/finance-notification";
import { FinanceToolbarActions } from "./_components/finance-toolbar-actions";
import { FinancialReportsTab } from "./_components/financial-reports-tab";
import { IncomeBreakdown } from "./_components/income-breakdown";
import { LedgerTab } from "./_components/ledger-tab";
import { OverviewKpis } from "./_components/overview-kpis";
import { QuickActions } from "./_components/quick-actions";
import { TransactionsOverviewCard } from "./_components/transactions-overview-card";
import { UpcomingTransactions } from "./_components/upcoming-transactions";
import { Wallet } from "./_components/wallet";

export default async function Page() {
  const data = await getFinanceDashboardData();
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">Gym Finance</h1>
        <p className="text-muted-foreground text-sm">{formattedDate}</p>
      </div>

      <Tabs defaultValue="30-days" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList variant="line">
            <TabsTrigger value="30-days">Dashboard</TabsTrigger>
            <TabsTrigger value="12-months">Reports</TabsTrigger>
            <TabsTrigger value="custom">Collections</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
          </TabsList>

          <FinanceToolbarActions updatedAt={format(new Date(), "hh:mm a")} />
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
              <TransactionsOverviewCard chart={data.chart} />
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

        <TabsContent value="12-months">
          <FinancialReportsTab chart={data.chart} totals={data.totals} />
        </TabsContent>

        <TabsContent value="custom">
          <CollectionsTab totals={data.totals} upcoming={data.upcoming} />
        </TabsContent>

        <TabsContent value="ledger">
          <LedgerTab dues={data.duesLedger} expenses={data.expensesLedger} payments={data.paymentsLedger} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
