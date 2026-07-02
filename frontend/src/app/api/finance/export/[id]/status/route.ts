import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

export async function GET(_request: Request, context: RouteContext<"/api/finance/export/[id]/status">) {
  const token = await getAuthToken();
  const { id } = await context.params;

  if (!token) {
    return NextResponse.json({ error: { message: "Missing authentication token." } }, { status: 401 });
  }

  const response = await fetch(`${API_BASE_URL}/export/status/${encodeURIComponent(id)}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  return NextResponse.json(payload ?? { error: { message: response.statusText } }, { status: response.status });
}
