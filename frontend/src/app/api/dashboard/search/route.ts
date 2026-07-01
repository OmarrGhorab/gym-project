import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

export async function GET(request: Request) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ data: [], message: "Unauthenticated" }, { status: 401 });
  }

  const search = new URL(request.url).search;
  const response = await fetch(`${API_BASE_URL}/search${search}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({ data: [] }));

  return NextResponse.json(payload, { status: response.status });
}
