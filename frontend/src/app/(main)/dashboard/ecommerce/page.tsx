import { getLocale, getTranslations } from "next-intl/server";

import { CustomerReviews } from "./_components/customer-reviews";
import { getPosDashboardData, normalizePosPaymentMethodFilter, normalizePosPeriodFilter } from "./_components/data";
import { Inventory } from "./_components/inventory";
import { KpiStrip } from "./_components/kpi-strip";
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
  const params = await searchParams;
  const period = normalizePosPeriodFilter(params?.period);
  const paymentMethod = normalizePosPaymentMethodFilter(params?.payment_method);
  const data = await getPosDashboardData({ paymentMethod, period });
  const formattedDate = new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{formattedDate}</p>
        </div>

        <PosFilterToolbar paymentMethod={paymentMethod} period={period} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <KpiStrip chart={data.sales_chart} totals={data.totals} />
        <div className="xl:col-span-5">
          <StoreTraffic data={data.hourly_activity} />
        </div>
        <div className="xl:col-span-7">
          <TrafficSources methods={data.payment_methods} />
        </div>
        <div className="xl:col-span-4">
          <TopProducts data={data.top_products} />
        </div>
        <div className="xl:col-span-4">
          <Inventory inventory={data.inventory} />
        </div>
        <div className="xl:col-span-4">
          <CustomerReviews alerts={data.stock_alerts} />
        </div>
        <div className="xl:col-span-12">
          <RecentOrders orders={data.recent_orders} />
        </div>
      </div>
    </div>
  );
}
