"use server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import type { ExportStatus } from "@/lib/api/dashboard";
import { getAuthToken } from "@/lib/session";

export type ExportRequestData = {
  resource: "members" | "subscriptions" | "sales" | "payments" | "payroll" | "reports";
  format: "xlsx" | "csv" | "pdf";
};

export async function requestExport(data: ExportRequestData): Promise<ExportStatus> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Unauthorized");
  }

  const params = new URLSearchParams({ format: data.format });
  const response = await fetch(`${API_BASE_URL}/export/${data.resource}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (response.ok && !contentType.includes("application/json")) {
    const blob = await response.blob();
    const bytes = Buffer.from(await blob.arrayBuffer());
    const base64 = bytes.toString("base64");

    return {
      export_id: `${data.resource}-${Date.now()}`,
      status: "ready",
      resource: data.resource,
      format: data.format,
      download_url: `data:${contentType || "application/octet-stream"};base64,${base64}`,
    };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    data?: ExportStatus;
    message?: string;
    error?: { message?: string; details?: Record<string, string[]> };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || response.statusText);
  }

  return payload.data ?? {
    export_id: `${data.resource}-${Date.now()}`,
    status: "ready",
    resource: data.resource,
    format: data.format,
  };
}
