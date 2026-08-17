import { serverApiFetch } from "@/lib/api/server";
import { canAccess } from "@/lib/authorization";
import { normalizeReportDateRange } from "@/lib/report-filters";
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
    plan_id?: string;
  }>;
}) {
  const query = await searchParams;
  const activeType = query.type ?? "overview";
  const user = await getCurrentUser();
  const hasFullReports = user ? canAccess(user, "reports.view") : false;
  const todayOnly = Boolean(user && !hasFullReports && canAccess(user, "reports.view_today"));
  const today = getGymTodayString();
  const normalizedRange = normalizeReportDateRange(query, today);
  const from = todayOnly ? today : normalizedRange.from;
  const to = todayOnly ? today : normalizedRange.to;
  const effectiveQuery = todayOnly ? { type: activeType, from, to } : { ...query, type: activeType, from, to };

  let initialData: Record<string, unknown> = {};
  let initialError: string | null = null;

  try {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    if (activeType === "overview") {
      const res = await serverApiFetch<Record<string, unknown>>(`/reports/overview?${params.toString()}`);
      initialData = res.data;
    } else if (activeType === "employees") {
      initialData = { employees: await fetchAllEmployeeReportRows(params) };
    } else if (activeType === "captains") {
      const res = await serverApiFetch<Record<string, unknown>>(`/reports/coach-extra-plans?${params.toString()}`);
      initialData = res.data;
    } else if (activeType === "classes_plans") {
      if (!todayOnly && query.status) params.set("status", query.status);
      if (!todayOnly && query.plan_id) params.set("plan_id", query.plan_id);
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
  } catch (error) {
    initialData = {};
    initialError = error instanceof Error ? error.message : "Unknown report error";
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
        initialError={initialError}
        todayOnly={todayOnly}
        today={today}
      />
    </div>
  );
}

async function fetchAllEmployeeReportRows(params: URLSearchParams): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  do {
    const pageParams = new URLSearchParams(params);
    if (cursor) pageParams.set("cursor", cursor);

    const response = await serverApiFetch<Record<string, unknown>[]>(`/reports/employees?${pageParams.toString()}`);
    rows.push(...response.data);

    const nextCursor = response.meta?.next_cursor;
    cursor = typeof nextCursor === "string" && nextCursor ? nextCursor : undefined;

    if (cursor) {
      if (seenCursors.has(cursor)) break;
      seenCursors.add(cursor);
    }
  } while (cursor);

  return rows;
}
