import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type NotificationRow = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string | null;
};

export async function getNotificationsPageData() {
  try {
    const result = await serverApiFetch<NotificationRow[] | PaginatedData<NotificationRow>>("/notifications?page=1");

    return unwrapList(result.data);
  } catch {
    return [];
  }
}
