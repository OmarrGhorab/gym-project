import { getLocale, getTranslations } from "next-intl/server";

import { canAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";

import { CustomerReviews } from "./_components/customer-reviews";
import { getPosDashboardData, normalizePosPaymentMethodFilter, normalizePosPeriodFilter } from "./_components/data";
import { Inventory } from "./_components/inventory";
import { KpiStrip } from "./_components/kpi-strip";
import { PosCheckoutDialog } from "./_components/pos-checkout-dialog";
import { PosFilterToolbar } from "./_components/pos-filter-toolbar";
import { RecentOrders } from "./_components/recent-orders";
import { StoreTraffic } from "./_components/store-traffic";
import { TopProducts } from "./_components/top-products";
import { TrafficSources } from "./_components/traffic-sources";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = await getTranslations("Dashboard.ecommerce");
  const user = await getCurrentUser();
  const params = await searchParams;
  const period = normalizePosPeriodFilter(params?.period);
  const paymentMethod = normalizePosPaymentMethodFilter(params?.payment_method);
  const data = await getPosDashboardData({ paymentMethod, period });
  const formattedDate = new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date());
  const canCreateSale = user ? canAccess(user, "sales.create") : false;
  const canViewReports = user ? canAccess(user, "reports.view") : false;
  const canViewProducts = user ? canAccess(user, "products.view") : false;
  const canVoidSale = user ? canAccess(user, "sales.void") : false;
  const hasSalesTotals =
    Number(data.totals.sales) > 0 ||
    data.totals.orders > 0 ||
    data.totals.member_buyers > 0 ||
    Number(data.totals.average_sale) > 0;
  const hasSalesChart = data.sales_chart.some((point) => Number(point.revenue) > 0 || point.orders > 0);
  const hasHourlyActivity = data.hourly_activity.some((point) => Number(point.revenue) > 0 || point.orders > 0);
  const hasPaymentMethods = data.payment_methods.some((method) => Number(method.amount) > 0 || method.count > 0);
  const hasTopProducts = data.top_products.products.length > 0;
  const hasInventory = data.inventory.products_total > 0;
  const hasStockAlerts = data.stock_alerts.length > 0;
  const hasRecentOrders = data.recent_orders.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{formattedDate}</p>
        </div>

        {canViewReports ? <PosFilterToolbar paymentMethod={paymentMethod} period={period} /> : null}
        {canCreateSale ? <PosCheckoutDialog members={data.members} products={data.products} /> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {canViewReports && (hasSalesTotals || hasSalesChart) ? (
          <KpiStrip chart={data.sales_chart} dailySales={data.daily_sales} totals={data.totals} />
        ) : null}
        {canViewReports && hasHourlyActivity ? (
          <div className="xl:col-span-5">
            <StoreTraffic data={data.hourly_activity} />
          </div>
        ) : null}
        {canViewReports && hasPaymentMethods ? (
          <div className="xl:col-span-7">
            <TrafficSources methods={data.payment_methods} />
          </div>
        ) : null}
        {canViewReports && hasTopProducts ? (
          <div className="xl:col-span-4">
            <TopProducts data={data.top_products} />
          </div>
        ) : null}
        {canViewProducts && hasInventory ? (
          <div className="xl:col-span-4">
            <Inventory inventory={data.inventory} />
          </div>
        ) : null}
        {canViewProducts && hasStockAlerts ? (
          <div className="xl:col-span-4">
            <CustomerReviews alerts={data.stock_alerts} />
          </div>
        ) : null}
        {hasRecentOrders ? (
          <div className="xl:col-span-12">
            <RecentOrders orders={data.recent_orders} canVoidSale={canVoidSale} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
