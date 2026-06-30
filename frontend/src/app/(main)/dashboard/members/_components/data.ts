import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type MemberRow = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
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
  latest_subscription: {
    id: number;
    plan_name: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
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
  histories: Record<number, MemberPaymentHistory | null>;
  members: MemberRow[];
  meta: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
  };
  visits: Record<number, MemberVisitRow[]>;
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

    const result = await serverApiFetch<MemberRow[] | PaginatedData<MemberRow>>(`/members?${params.toString()}`);
    const members = unwrapList(result.data);

    return {
      histories: {},
      meta: getMeta(result),
      members,
      visits: {},
    };
  } catch (error) {
    console.error("[getMembersPageData] Failed to fetch members:", error);
    return { histories: {}, members: [], meta: {}, visits: {} };
  }
}

async function safeFetch<T>(path: string, fallback: T): Promise<{ data: T }> {
  try {
    return await serverApiFetch<T>(path);
  } catch (error) {
    console.error(`[safeFetch] Failed to fetch ${path}:`, error);
    return { data: fallback };
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
