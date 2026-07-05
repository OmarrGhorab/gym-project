import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type PlanRow = {
  id: number;
  name: string;
  description: string | null;
  price: string;
  duration_days: number;
  duration_months: number | null;
  sessions_count: number | null;
  is_unlimited_sessions: boolean;
  type: string;
  category: string;
  is_active: boolean;
  is_sellable: boolean;
  valid_from: string | null;
  valid_to: string | null;
  access_starts_at: string | null;
  access_ends_at: string | null;
  max_freeze_days: number;
  access_grace_days: number;
  min_freeze_days: number;
  freeze_requires_approval: boolean;
  created_at: string | null;
};

export async function getPlansPageData() {
  try {
    const result = await serverApiFetch<PlanRow[] | PaginatedData<PlanRow>>("/plans?sort=name&per_page=100");

    return unwrapList(result.data);
  } catch {
    return [];
  }
}
