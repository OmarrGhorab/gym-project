import { type NextRequest, NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const response = await fetch(`${API_BASE_URL}/sales/${id}/receipt`, {
    headers: {
      Accept: "application/pdf",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json({ message: "Could not download sale receipt." }, { status: response.status });
  }

  return new NextResponse(response.body, {
    headers: {
      "Content-Disposition":
        response.headers.get("Content-Disposition") ?? `attachment; filename="sale-${id}-receipt.pdf"`,
      "Content-Type": response.headers.get("Content-Type") ?? "application/pdf",
    },
  });
}
