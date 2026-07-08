import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

const formats = new Set(["xlsx", "pdf"]);
const locales = new Set(["en", "ar"]);

export async function GET(request: Request) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: { message: "Missing authentication token." } }, { status: 401 });
  }

  const url = new URL(request.url);
  const now = new Date();
  const format = url.searchParams.get("format") ?? "xlsx";
  const locale = url.searchParams.get("locale") ?? "en";
  const from =
    url.searchParams.get("from") ?? new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
  const to = url.searchParams.get("to") ?? now.toISOString().slice(0, 10);
  const groupBy = url.searchParams.get("group_by") === "day" ? "day" : "month";

  if (!formats.has(format)) {
    return NextResponse.json({ error: { message: "Invalid export format." } }, { status: 422 });
  }

  if (!locales.has(locale)) {
    return NextResponse.json({ error: { message: "Invalid export locale." } }, { status: 422 });
  }

  const params = new URLSearchParams({
    format,
    locale,
    "filter[type]": "financial_detailed",
    "filter[from]": from,
    "filter[to]": to,
    "filter[group_by]": groupBy,
  });

  const response = await fetch(`${API_BASE_URL}/export/reports?${params.toString()}`, {
    headers: {
      Accept:
        format === "pdf"
          ? "application/pdf, application/json"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json",
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
        response.headers.get("Content-Disposition") ?? `attachment; filename="finance-report.${format}"`,
      "Content-Type":
        response.headers.get("Content-Type") ??
        (format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    },
    status: response.status,
  });
}
