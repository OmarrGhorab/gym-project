import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

export async function GET(request: Request, context: RouteContext<"/api/finance/export/[id]/download">) {
  const token = await getAuthToken();
  const { id } = await context.params;
  const search = new URL(request.url).search;

  if (!token) {
    return NextResponse.json({ error: { message: "Missing authentication token." } }, { status: 401 });
  }

  const response = await fetch(`${API_BASE_URL}/export/download/${encodeURIComponent(id)}${search}`, {
    headers: {
      Accept: "*/*",
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
      "Content-Disposition": response.headers.get("Content-Disposition") ?? `attachment; filename="export-${id}"`,
      "Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream",
    },
    status: response.status,
  });
}
