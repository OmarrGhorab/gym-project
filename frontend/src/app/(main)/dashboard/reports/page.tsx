import { serverApiFetch } from "@/lib/api/server";

import { ReportViewClient } from "./_components/report-view-client";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    from?: string;
    to?: string;
    status?: string;
    category?: string;
    search?: string;
    payment_method?: string;
    group_by?: string;
  }>;
}) {
  const query = await searchParams;
  const activeType = query.type ?? "classes_plans";
  const from = query.from ?? "";
  const to = query.to ?? "";

  let initialData: Record<string, unknown> = {};

  try {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    if (activeType === "classes_plans") {
      if (query.status) params.set("status", query.status);
      const res = await serverApiFetch<Record<string, unknown>>(`/reports/classes-plans?${params.toString()}`);
      initialData = res.data;
    } else if (activeType === "products_finance") {
      if (query.category) params.set("category", query.category);
      if (query.search) params.set("search", query.search);
      if (query.payment_method) params.set("payment_method", query.payment_method);
      const res = await serverApiFetch<Record<string, unknown>>(`/reports/products-finance?${params.toString()}`);
      initialData = res.data;
    } else if (activeType === "subs_shifts") {
      if (query.status) params.set("status", query.status);
      const res = await serverApiFetch<Record<string, unknown>>(`/reports/subs-shifts?${params.toString()}`);
      initialData = res.data;
    } else if (activeType === "income_outcome") {
      if (query.group_by) params.set("group_by", query.group_by);
      const res = await serverApiFetch<Record<string, unknown>>(`/reports/income-outcome?${params.toString()}`);
      initialData = res.data;
    }
  } catch {
    initialData = {};
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="font-bold text-3xl tracking-tight">Reports Hub</h1>
        <p className="text-muted-foreground text-sm">
          Comprehensive performance, member subscriptions, product sales, shift revenue, and cashflow analytics.
        </p>
      </div>

      <ReportViewClient initialType={activeType} initialQuery={query} initialData={initialData} />
    </div>
  );
}
