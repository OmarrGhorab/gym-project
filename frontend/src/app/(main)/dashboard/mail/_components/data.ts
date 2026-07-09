import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type NotificationRow = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string | null;
};

export type NotificationQuery = {
  page?: string;
  status?: string;
  category?: string;
  per_page?: string;
};

export type NotificationsPageData = {
  notifications: NotificationRow[];
  meta: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
  };
};

export async function getNotificationsPageData(query: NotificationQuery = {}): Promise<NotificationsPageData> {
  const params = new URLSearchParams({
    page: query.page ?? "1",
    per_page: query.per_page ?? "15",
  });

  if (query.status && query.status !== "all") params.set("status", query.status);
  if (query.category) params.set("category", query.category);

  try {
    const result = await serverApiFetch<NotificationRow[] | PaginatedData<NotificationRow>>(
      `/notifications?${params.toString()}`,
    );

    return {
      meta: getMeta(result),
      notifications: unwrapList(result.data),
    };
  } catch {
    return { meta: {}, notifications: [] };
  }
}

function getMeta(
  result: Awaited<ReturnType<typeof serverApiFetch<NotificationRow[] | PaginatedData<NotificationRow>>>>,
) {
  if (result.meta) {
    return result.meta;
  }

  if (!Array.isArray(result.data) && result.data.meta) {
    return result.data.meta;
  }

  return {};
}
