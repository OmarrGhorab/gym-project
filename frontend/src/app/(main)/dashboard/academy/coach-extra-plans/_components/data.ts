import { serverApiFetch } from "@/lib/api/server";

export type CoachExtraPlanMember = {
  addon_id: number;
  member_id: number;
  member_name: string;
  member_code: string;
  member_phone: string;
  plan_name: string;
  plan_category?: string;
  coach_name?: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  price_paid: string;
  sessions_total: number;
  sessions_remaining: number;
  sessions_used: number;
  attended_days_this_month: number;
  total_visits_this_month: number;
  last_visit_at: string | null;
};

export type CoachExtraPlanItem = {
  coach_id: number;
  coach_name: string;
  coach_role: string | null;
  coach_phone: string | null;
  active_addons_count: number;
  total_addons_count: number;
  subscribed_members_count: number;
  attended_days_count: number;
  total_visits_count: number;
  total_revenue: string;
  plans_summary: Array<{
    plan_id: number | null;
    plan_name: string;
    count: number;
  }>;
  members: CoachExtraPlanMember[];
};

export type CoachExtraPlansReportData = {
  generated_at: string;
  period: {
    from: string;
    to: string;
  };
  kpis: {
    total_coached_addons: number;
    total_subscribed_members: number;
    total_attended_days: number;
    total_addon_revenue: string;
  };
  coaches: CoachExtraPlanItem[];
};

export async function getCoachExtraPlansReport(
  from: string,
  to: string,
  coachId?: string,
): Promise<CoachExtraPlansReportData> {
  const params = new URLSearchParams({ from, to });
  if (coachId) {
    params.set("coach_id", coachId);
  }

  try {
    const response = await serverApiFetch<CoachExtraPlansReportData>(`/reports/coach-extra-plans?${params.toString()}`);
    return response.data;
  } catch {
    return {
      generated_at: new Date().toISOString(),
      period: { from, to },
      kpis: {
        total_coached_addons: 0,
        total_subscribed_members: 0,
        total_attended_days: 0,
        total_addon_revenue: "0.00",
      },
      coaches: [],
    };
  }
}
