import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken();
  const { id } = await params;

  if (!token) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const response = await fetch(`${API_BASE_URL}/sales/${id}/receipt`, {
    headers: {
      Accept: "application/pdf",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: { message: response.statusText || "Receipt download failed" } },
      { status: response.status }
    );
  }

  const body = await response.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/pdf",
      "Content-Disposition": response.headers.get("content-disposition") ?? `inline; filename="receipt-${id}.pdf"`,
    },
  });
}
