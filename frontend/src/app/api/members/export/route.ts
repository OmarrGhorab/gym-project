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
  const format = url.searchParams.get("format") ?? "xlsx";
  const locale = url.searchParams.get("locale") ?? "en";

  if (!formats.has(format)) {
    return NextResponse.json({ error: { message: "Invalid export format." } }, { status: 422 });
  }

  if (!locales.has(locale)) {
    return NextResponse.json({ error: { message: "Invalid export locale." } }, { status: 422 });
  }

  const params = new URLSearchParams({ format, locale });
  const search = url.searchParams;
  const filterMap: Array<[string, string]> = [
    ["q", "filter[search]"],
    ["status", "filter[status]"],
    ["plan", "filter[subscription_status]"],
    ["qr", "filter[qr]"],
  ];

  for (const [source, target] of filterMap) {
    const value = search.get(source)?.trim();

    if (value && value !== "all") {
      params.set(target, value);
    }
  }

  const response = await fetch(`${API_BASE_URL}/export/members?${params.toString()}`, {
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
      "Content-Disposition": response.headers.get("Content-Disposition") ?? `attachment; filename="members.${format}"`,
      "Content-Type":
        response.headers.get("Content-Type") ??
        (format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    },
    status: response.status,
  });
}
