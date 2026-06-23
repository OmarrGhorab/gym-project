import { NextResponse } from "next/server";
import { isValidRouteId, proxyMedia } from "@/lib/api/media-proxy";
import { getAuthToken } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const { id } = await params;

  if (!isValidRouteId(id)) {
    return NextResponse.json(
      { error: { message: "Invalid product id" } },
      { status: 400 }
    );
  }

  return proxyMedia(`/products/${id}/image`, token);
}
