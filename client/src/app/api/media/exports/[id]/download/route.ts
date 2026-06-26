import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken();
  const { id } = await params;

  if (!token) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: { message: "Invalid export id" } }, { status: 400 });
  }

  const search = request.nextUrl.search;
  const response = await fetch(`${API_BASE_URL}/export/download/${id}${search}`, {
    headers: {
      Accept: "*/*",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    return NextResponse.json(
      payload ?? { error: { message: response.statusText || "Export download failed" } },
      { status: response.status }
    );
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": response.headers.get("content-disposition") ?? `attachment; filename="export-${id}"`,
    },
  });
}
