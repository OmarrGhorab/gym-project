import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type AuditLogRow = {
  id: number;
  action: string;
  description: string;
  causer: {
    id: number;
    name: string;
  } | null;
  causer_type: string;
  subject: {
    type: string;
    id: number;
    label?: string | null;
  } | null;
  changes: Record<string, unknown>;
  properties: Record<string, unknown>;
  created_at: string;
};

export type AuditQuery = {
  page?: string;
  from?: string;
  to?: string;
  subject?: string;
  causer?: string;
  action?: string;
  log_name?: string;
  per_page?: string;
};

export type AuditPageData = {
  logs: AuditLogRow[];
  meta: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
  };
};

export async function getAuditPageData(query: AuditQuery = {}): Promise<AuditPageData> {
  const params = new URLSearchParams({
    page: query.page ?? "1",
    per_page: query.per_page ?? "20",
    sort: "-created_at",
  });

  if (query.from) params.set("filter[from]", query.from);
  if (query.to) params.set("filter[to]", query.to);
  if (query.subject) params.set("filter[subject]", query.subject);
  if (query.causer) params.set("filter[causer]", query.causer);
  if (query.action) params.set("filter[action]", query.action);
  if (query.log_name) params.set("filter[log_name]", query.log_name);

  try {
    const result = await serverApiFetch<AuditLogRow[] | PaginatedData<AuditLogRow>>(`/audit-logs?${params.toString()}`);

    return {
      logs: unwrapList(result.data),
      meta: getMeta(result),
    };
  } catch {
    return { logs: [], meta: {} };
  }
}

function getMeta(result: Awaited<ReturnType<typeof serverApiFetch<AuditLogRow[] | PaginatedData<AuditLogRow>>>>) {
  if (result.meta) {
    return result.meta;
  }

  if (!Array.isArray(result.data) && result.data.meta) {
    return result.data.meta;
  }

  return {};
}
