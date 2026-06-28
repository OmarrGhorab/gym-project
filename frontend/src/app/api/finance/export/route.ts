import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

export async function GET() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: { message: "Missing authentication token." } }, { status: 401 });
  }

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    format: "xlsx",
    "filter[type]": "financial",
    "filter[from]": from,
    "filter[to]": to,
    "filter[group_by]": "month",
  });

  const response = await fetch(`${API_BASE_URL}/export/reports?${params.toString()}`, {
    headers: {
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { error: { message: response.statusText } }, { status: response.status });
  }

  return new NextResponse(response.body, {
    headers: {
      "Content-Disposition":
        response.headers.get("Content-Disposition") ?? 'attachment; filename="finance-report.xlsx"',
      "Content-Type":
        response.headers.get("Content-Type") ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    status: response.status,
  });
}
