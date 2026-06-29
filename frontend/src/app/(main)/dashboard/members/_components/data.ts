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
  visits: Record<number, MemberVisitRow[]>;
};

export async function getMembersPageData(): Promise<MembersPageData> {
  try {
    const result = await serverApiFetch<MemberRow[] | PaginatedData<MemberRow>>(
      "/members?sort=-created_at&per_page=100",
    );

    const members = unwrapList(result.data);
    const detailMembers = members.slice(0, 20);
    const details = await Promise.all(
      detailMembers.map(async (member) => {
        const [historyResult, visitsResult] = await Promise.all([
          safeFetch<MemberPaymentHistory | null>(`/members/${member.id}/payment-history`, null),
          safeFetch<MemberVisitRow[] | PaginatedData<MemberVisitRow>>(
            `/member-visits?member_id=${member.id}&sort=-check_in_at&per_page=5`,
            [],
          ),
        ]);

        return {
          history: historyResult.data,
          id: member.id,
          visits: unwrapList(visitsResult.data),
        };
      }),
    );

    return {
      histories: Object.fromEntries(details.map((detail) => [detail.id, detail.history])),
      members,
      visits: Object.fromEntries(details.map((detail) => [detail.id, detail.visits])),
    };
  } catch {
    return { histories: {}, members: [], visits: {} };
  }
}

async function safeFetch<T>(path: string, fallback: T): Promise<{ data: T }> {
  try {
    return await serverApiFetch<T>(path);
  } catch {
    return { data: fallback };
  }
}
