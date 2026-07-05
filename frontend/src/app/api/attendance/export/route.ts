import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

const resources = new Set(["attendance", "member-visits"]);
const periods = new Set(["daily", "monthly"]);

export async function GET(request: Request) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: { message: "Missing authentication token." } }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const resource = searchParams.get("resource") ?? "attendance";
  const period = searchParams.get("period") ?? "daily";

  if (!resources.has(resource) || !periods.has(period)) {
    return NextResponse.json({ error: { message: "Invalid attendance export request." } }, { status: 422 });
  }

  const params = new URLSearchParams({ format: "xlsx" });
  params.set("filter[period]", period);

  if (period === "monthly") {
    params.set("filter[month]", searchParams.get("month") ?? new Date().toISOString().slice(0, 7));
  } else {
    params.set("filter[date]", searchParams.get("date") ?? new Date().toISOString().slice(0, 10));
  }

  const response = await fetch(`${API_BASE_URL}/export/${resource}?${params.toString()}`, {
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

  const filename = `${resource}-${period}-attendance.xlsx`;

  return new NextResponse(response.body, {
    headers: {
      "Content-Disposition": response.headers.get("Content-Disposition") ?? `attachment; filename="${filename}"`,
      "Content-Type":
        response.headers.get("Content-Type") ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    status: response.status,
  });
}
