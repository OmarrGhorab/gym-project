import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

export async function GET(request: Request) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ data: [], message: "Unauthenticated" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const params = new URLSearchParams({
    "filter[status]": "active",
    per_page: "100",
  });
  const query = searchParams.get("q")?.trim();

  if (query) {
    params.set("filter[q]", query);
  }

  const response = await fetch(`${API_BASE_URL}/employees?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({ data: [] }));

  return NextResponse.json(payload, { status: response.status });
}
