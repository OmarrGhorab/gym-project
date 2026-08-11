import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: { message: "Missing authentication token." } }, { status: 401 });
  }

  const date = new URL(request.url).searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  if (!datePattern.test(date)) {
    return NextResponse.json({ error: { message: "Invalid report date." } }, { status: 422 });
  }

  const response = await fetch(`${API_BASE_URL}/attendance/daily-report?date=${encodeURIComponent(date)}`, {
    headers: {
      Accept: "application/pdf, application/json",
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
        response.headers.get("Content-Disposition") ?? `inline; filename="daily-attendance-${date}.pdf"`,
      "Content-Type": response.headers.get("Content-Type") ?? "application/pdf",
    },
    status: response.status,
  });
}
