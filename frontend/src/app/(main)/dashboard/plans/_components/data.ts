import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type PlanRow = {
  id: number;
  name: string;
  description: string | null;
  price: string;
  duration_days: number;
  sessions_count: number | null;
  type: string;
  is_active: boolean;
  is_sellable: boolean;
  max_freeze_days: number;
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
