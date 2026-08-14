import { Suspense } from "react";

import { format as formatDateFns, parseISO, subDays } from "date-fns";
import { getLocale, getTranslations } from "next-intl/server";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { GYM_TIME_ZONE, getGymTodayString } from "@/lib/timezone";

import { BalanceDistributionCard } from "./_components/balance-distribution-card";
import { getFinanceDashboardData } from "./_components/data";
import { FinanceFilters } from "./_components/finance-filters";
import { FinanceNotification } from "./_components/finance-notification";
import { FinanceToolbarActions } from "./_components/finance-toolbar-actions";
import { IncomeBreakdown } from "./_components/income-breakdown";
import { LedgerTab } from "./_components/ledger-tab";
import { OverviewKpis } from "./_components/overview-kpis";
import { QuickActions } from "./_components/quick-actions";
import { ShiftDesk } from "./_components/shift-desk";
import { TransactionsOverviewCard } from "./_components/transactions-overview-card";
import { UpcomingTransactions } from "./_components/upcoming-transactions";
import { Wallet } from "./_components/wallet";

function defaultFrom(today: string) {
  return formatDateFns(subDays(parseISO(today), 364), "yyyy-MM-dd");
}

function defaultTo() {
  return getGymTodayString();
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; group_by?: string; tab?: string }>;
}) {
  const t = await getTranslations("Dashboard.finance");
  const locale = await getLocale();
  const user = await getCurrentUser();
  const { from, to, group_by, tab } = await searchParams;
  const today = defaultTo();
  const hasFullReports = user ? canAccess(user, "reports.view") : false;
  const todayOnly = Boolean(user && !hasFullReports && canAccess(user, "reports.view_today"));
  const requestedFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : defaultFrom(today);
  const requestedTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : today;
  const resolvedFrom = todayOnly ? today : requestedFrom;
  const resolvedTo = todayOnly ? today : requestedTo;
  const groupBy = todayOnly || group_by === "day" ? "day" : "month";
  const canExportReports = !todayOnly && Boolean(user && canAccess(user, "export.reports"));
  const canRecordExpense = user ? canAccess(user, "expenses.create") : false;
  const canCollectDue = user ? canAccess(user, "payments.create") : false;
  const canViewExpenses = user ? canAccess(user, "expenses.view") : false;
  const canViewPayments = user ? canAccess(user, "payments.view") : false;
  const canUseShiftDesk = canRecordExpense || canCollectDue || canViewExpenses || canViewPayments;
  const quickActionPermissions = {
    canCollectDue: !todayOnly && canCollectDue,
    canExport: canExportReports,
    canRecordExpense,
    canDeleteExpense: !todayOnly && Boolean(user && canAccess(user, "expenses.delete")),
    canUpdateExpense: !todayOnly && Boolean(user && canAccess(user, "expenses.update")),
    canViewExpenses: !todayOnly && canViewExpenses,
    canViewPayments: !todayOnly && canViewPayments,
    canViewPayroll: !todayOnly && Boolean(user && canAccess(user, "payroll.view")),
    canViewReports: hasFullReports || todayOnly,
  };
  const data = await getFinanceDashboardData(resolvedFrom, resolvedTo, groupBy, {
    ...quickActionPermissions,
    canCollectDue,
    canUseShiftDesk,
    canViewExpenses,
    canViewPayments,
    todayOnly,
  });
  const canViewLedger =
    quickActionPermissions.canViewPayments ||
    quickActionPermissions.canCollectDue ||
    quickActionPermissions.canViewExpenses;
  const canOperateShiftDesk = canRecordExpense || canCollectDue;
  const canReviewShiftDesk =
    quickActionPermissions.canUpdateExpense || (user ? canAccess(user, "settings.manage") : false);
  const formattedDate = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: GYM_TIME_ZONE }).format(
    new Date(),
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{formattedDate}</p>
      </div>

      {canUseShiftDesk ? (
        <ShiftDesk
          currentSession={data.shiftDesk.current}
          historySessions={data.shiftDesk.history}
          pendingSessions={data.shiftDesk.pending}
          shifts={data.shiftDesk.shifts}
          requireHandoverToOpen={data.shiftDesk.requireHandoverToOpen}
          requireCashCount={data.shiftDesk.requireCashCount}
          canOperate={canOperateShiftDesk}
          canReview={canReviewShiftDesk}
        />
      ) : null}

      <Tabs defaultValue={tab === "ledger" && canViewLedger ? "ledger" : "30-days"} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList variant="line">
            <TabsTrigger value="30-days">{t("tabs.dashboard")}</TabsTrigger>
            {canViewLedger ? <TabsTrigger value="ledger">{t("tabs.ledger")}</TabsTrigger> : null}
          </TabsList>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            {todayOnly ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-muted-foreground text-sm">
                {t("todayOnlyAccess")}
              </div>
            ) : (
              <Suspense>
                <FinanceFilters
                  defaults={{
                    from: resolvedFrom,
                    to: resolvedTo,
                  }}
                />
              </Suspense>
            )}
            <Suspense>
              <FinanceToolbarActions
                canExport={canExportReports}
                canRecordExpense={canRecordExpense}
                exportDefaults={{
                  from: resolvedFrom,
                  groupBy,
                  locale,
                  to: resolvedTo,
                }}
                updatedAt={new Intl.DateTimeFormat(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: GYM_TIME_ZONE,
                }).format(new Date())}
              />
            </Suspense>
          </div>
        </div>

        <TabsContent value="30-days" className="flex flex-col gap-4">
          {quickActionPermissions.canViewReports ? (
            <>
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
            </>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {quickActionPermissions.canViewPayments ? (
              <div className="xl:col-span-4">
                <Wallet methods={data.payment_methods} />
              </div>
            ) : null}
            {quickActionPermissions.canViewReports ? (
              <div className="xl:col-span-4">
                <UpcomingTransactions upcoming={data.upcoming} totals={data.totals} />
              </div>
            ) : null}
            <div className="xl:col-span-4">
              <QuickActions permissions={quickActionPermissions} />
            </div>
          </div>
        </TabsContent>

        {canViewLedger ? (
          <TabsContent value="ledger">
            <LedgerTab
              canCollectDue={quickActionPermissions.canCollectDue}
              canManageExpenses={quickActionPermissions.canUpdateExpense || quickActionPermissions.canDeleteExpense}
              dues={data.duesLedger}
              expenses={data.expensesLedger}
              payments={data.paymentsLedger}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
