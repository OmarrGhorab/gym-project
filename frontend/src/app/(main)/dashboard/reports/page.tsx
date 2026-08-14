import { serverApiFetch } from "@/lib/api/server";
import { canAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";
import { getGymTodayString } from "@/lib/timezone";

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
  const activeType = query.type ?? "overview";
  const user = await getCurrentUser();
  const hasFullReports = user ? canAccess(user, "reports.view") : false;
  const todayOnly = Boolean(user && !hasFullReports && canAccess(user, "reports.view_today"));
  const today = getGymTodayString();
  const from = todayOnly ? today : (query.from ?? "");
  const to = todayOnly ? today : (query.to ?? "");
  const effectiveQuery = todayOnly ? { type: activeType, from, to } : query;

  let initialData: Record<string, unknown> = {};

  try {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    if (activeType === "overview") {
      const res = await serverApiFetch<Record<string, unknown>>(`/reports/overview?${params.toString()}`);
      initialData = res.data;
    } else if (activeType === "employees") {
      const res = await serverApiFetch<Record<string, unknown>>(`/reports/employees?${params.toString()}`);
      initialData = { employees: res.data };
    } else if (activeType === "captains") {
      const res = await serverApiFetch<Record<string, unknown>>(`/reports/coach-extra-plans?${params.toString()}`);
      initialData = res.data;
    } else if (activeType === "classes_plans") {
      if (!todayOnly && query.status) params.set("status", query.status);
      const res = await serverApiFetch<Record<string, unknown>>(`/reports/classes-plans?${params.toString()}`);
      initialData = res.data;
    } else if (activeType === "products_finance") {
      if (!todayOnly && query.category) params.set("category", query.category);
      if (!todayOnly && query.search) params.set("search", query.search);
      if (!todayOnly && query.payment_method) params.set("payment_method", query.payment_method);
      const res = await serverApiFetch<Record<string, unknown>>(`/reports/products-finance?${params.toString()}`);
      initialData = res.data;
    } else if (activeType === "member_subscriptions") {
      if (!todayOnly && query.status) params.set("status", query.status);
      if (!todayOnly && query.search) params.set("search", query.search);
      const res = await serverApiFetch<Record<string, unknown>>(`/reports/member-subscriptions?${params.toString()}`);
      initialData = res.data;
    } else if (activeType === "subs_shifts") {
      if (!todayOnly && query.status) params.set("status", query.status);
      const res = await serverApiFetch<Record<string, unknown>>(`/reports/subs-shifts?${params.toString()}`);
      initialData = res.data;
    } else if (activeType === "income_outcome") {
      if (!todayOnly && query.group_by) params.set("group_by", query.group_by);
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

      <ReportViewClient
        initialType={activeType}
        initialQuery={effectiveQuery}
        initialData={initialData}
        todayOnly={todayOnly}
        today={today}
      />
    </div>
  );
}
