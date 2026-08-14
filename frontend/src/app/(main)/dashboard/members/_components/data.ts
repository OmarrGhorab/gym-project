import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";
import type { PlanRow } from "../../plans/_components/data";

export type StaffOption = {
  id: number;
  name: string;
  role: string | null;
};

export type MemberRow = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  national_id: string | null;
  gender: string | null;
  attendance_code: string | null;
  attendance_qr: string | null;
  birth_date: string | null;
  join_date: string | null;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  has_photo: boolean;
  total_paid: string;
  visits_this_month?: number;
  updated_at?: string | null;
  latest_subscription: {
    id: number;
    plan_id?: number | null;
    plan_name: string | null;
    plan?: { id: number; name: string; price: string | number } | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
    price_paid?: string | null;
    discount?: string | null;
    paid_total?: string | null;
    balance?: string | null;
    package_price_paid?: string | null;
    package_paid_total?: string | null;
    package_balance?: string | null;
    cancellation_grace_days?: number | null;
    sessions_total?: number | null;
    sessions_remaining?: number | null;
    can_cancel_with_refund?: boolean | null;
    cancellation_grace_ends_on?: string | null;
    default_refund_amount?: string | null;
    addons?: {
      id: number;
      status?: string;
      end_date: string | null;
      price_paid?: string;
      paid_total?: string;
      sessions_total?: number | null;
      sessions_remaining?: number | null;
      coach?: {
        id?: number;
        name?: string | null;
      } | null;
      plan?: {
        id?: number;
        name?: string | null;
      } | null;
    }[];
  } | null;
};

export type MemberPaymentHistory = {
  member: {
    id: number;
    name: string;
    phone: string;
  };
  totals: {
    subscription_total: string;
    subscription_paid: string;
    product_paid: string;
    total_paid: string;
    outstanding_balance: string;
  };
  subscription_payments: {
    id: number;
    subscription_id: number;
    plan_name: string | null;
    amount: string;
    method: string;
    status: string;
    paid_at: string | null;
    due_date: string | null;
  }[];
  product_purchases: {
    id: number;
    total: string;
    payment_method: string;
    status: string;
    sold_by: string | null;
    created_at: string | null;
    items: {
      product_id: number;
      product_name: string | null;
      quantity: number;
      unit_price: string;
      total: string;
    }[];
  }[];
};

export type MemberReportData = {
  summary: {
    blocked_visits: number;
    days_at_gym: number | null;
    latest_body_fat_percent: number | null;
    latest_weight_kg: number | null;
    subscriptions_count: number;
    total_paid: string;
    total_visits: number;
    weight_change_kg: string | null;
  };
  progress: Array<{
    id: number;
    recorded_on: string | null;
  }>;
  workout_plans: Array<{
    id: number;
    title: string;
    coach: { id: number; name: string } | null;
  }>;
  nutrition_plans: Array<{
    id: number;
    title: string;
    coach: { id: number; name: string } | null;
  }>;
  bookings: Array<{
    id: number;
    title: string;
    coach: { id: number; name: string } | null;
  }>;
  documents: Array<{
    id: number;
    title: string;
  }>;
};

export type MemberPaymentRow = {
  id: number;
  amount: string;
  method: string;
  status: string;
  paid_at: string | null;
  due_date: string | null;
  created_by: number | null;
};

export type MemberDueRow = {
  subscription_id: number;
  member_id: number | null;
  member_name: string | null;
  subscription_status: string;
  end_date: string | null;
  balance: string;
  paid_total: string;
  price_paid: string;
};

export type MemberVisitRow = {
  id: number;
  member_id: number;
  check_in_at: string | null;
  check_out_at: string | null;
  status: string;
  scan_method: string;
  alert_reason: string | null;
  notes: string | null;
  check_in_location?: {
    status: string | null;
    distance_meters: number | null;
  };
};

export type MembersPageData = {
  dues: Record<number, MemberDueRow>;
  histories: Record<number, MemberPaymentHistory | null>;
  members: MemberRow[];
  meta: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
  };
  payments: Record<number, MemberPaymentRow[]>;
  visits: Record<number, MemberVisitRow[]>;
  plans: PlanRow[];
  staff: StaffOption[];
};

export type MembersQuery = {
  page?: string;
  per_page?: string;
  plan?: string;
  qr?: string;
  q?: string;
  status?: string;
};

export async function getMembersPageData(query: MembersQuery = {}): Promise<MembersPageData> {
  try {
    const params = new URLSearchParams({
      page: query.page ?? "1",
      per_page: query.per_page ?? "15",
      sort: "-created_at",
    });

    if (query.status && query.status !== "all") {
      params.set("filter[status]", query.status);
    }

    if (query.q) {
      params.set("filter[search]", query.q);
    }

    if (query.plan && query.plan !== "all") {
      params.set("filter[subscription_status]", query.plan);
    }

    if (query.qr && query.qr !== "all") {
      params.set("filter[qr]", query.qr);
    }

    const [result, plansResult, staffResult, duesResult] = await Promise.all([
      serverApiFetch<MemberRow[] | PaginatedData<MemberRow>>(`/members?${params.toString()}`),
      serverApiFetch<PlanRow[] | PaginatedData<PlanRow>>("/plans?filter[is_active]=1&sort=name&per_page=100").catch(
        () => ({ data: [] as PlanRow[] }),
      ),
      serverApiFetch<StaffOption[] | PaginatedData<StaffOption>>("/employees?filter[status]=active&per_page=100").catch(
        () => ({ data: [] as StaffOption[] }),
      ),
      serverApiFetch<MemberDueRow[] | PaginatedData<MemberDueRow>>("/payments/dues?per_page=100").catch(() => ({
        data: [] as MemberDueRow[],
      })),
    ]);
    const members = unwrapList(result.data);
    const plans = unwrapList(plansResult.data as PlanRow[] | PaginatedData<PlanRow>);
    const staff = unwrapList(staffResult.data as StaffOption[] | PaginatedData<StaffOption>);
    const dues = unwrapList(duesResult.data as MemberDueRow[] | PaginatedData<MemberDueRow>);

    return {
      dues: mapMemberDues(dues),
      histories: {},
      meta: getMeta(result),
      members,
      payments: {},
      visits: {},
      plans,
      staff,
    };
  } catch (error) {
    console.error("[getMembersPageData] Failed to fetch members:", error);
    return { dues: {}, histories: {}, members: [], meta: {}, payments: {}, visits: {}, plans: [], staff: [] };
  }
}

function getMeta(result: Awaited<ReturnType<typeof serverApiFetch<MemberRow[] | PaginatedData<MemberRow>>>>) {
  if (result.meta) {
    return result.meta;
  }

  if (!Array.isArray(result.data) && result.data.meta) {
    return result.data.meta;
  }

  return {};
}

function mapMemberDues(dues: MemberDueRow[]) {
  const result: Record<number, MemberDueRow> = {};

  for (const due of dues) {
    if (typeof due.member_id !== "number" || due.member_id <= 0) {
      continue;
    }

    result[due.member_id] = due;
  }

  return result;
}
