import { format } from "date-fns";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { CustomerReviews } from "./_components/customer-reviews";
import { getPosDashboardData } from "./_components/data";
import { Inventory } from "./_components/inventory";
import { KpiStrip } from "./_components/kpi-strip";
import { RecentOrders } from "./_components/recent-orders";
import { StoreTraffic } from "./_components/store-traffic";
import { TopProducts } from "./_components/top-products";
import { TrafficSources } from "./_components/traffic-sources";

export default async function Page() {
  const data = await getPosDashboardData();
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Gym POS Overview</h1>
          <p className="text-muted-foreground text-sm">{formattedDate}</p>
        </div>

        <div className="flex flex-wrap items-end justify-end gap-2 lg:w-fit">
          <Select defaultValue="this-month">
            <SelectTrigger className="w-34" id="ecommerce-period" size="sm">
              <SelectValue placeholder="This Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                <SelectItem value="year-to-date">Year to Date</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select defaultValue="pos">
            <SelectTrigger className="w-40" id="ecommerce-channel" size="sm">
              <SelectValue placeholder="POS" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="pos">POS</SelectItem>
                <SelectItem value="cash">Cash Sales</SelectItem>
                <SelectItem value="card">Card Sales</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
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
