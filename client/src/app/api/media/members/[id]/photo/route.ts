import { NextResponse } from "next/server";
import { buildApiUrl } from "@/app/api/auth/_lib";
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

  return proxyMedia(`/members/${id}/photo`, token);
}

async function proxyMedia(path: string, token: string) {
  try {
    const response = await fetch(buildApiUrl(path), {
      headers: {
        Accept: "image/*",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: { message: response.statusText } },
        { status: response.status }
      );
    }

    const headers = new Headers();
    const contentType = response.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    headers.set("cache-control", "private, no-store, no-cache, must-revalidate, max-age=0");
    headers.set("pragma", "no-cache");
    headers.set("expires", "0");

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: { message: "Media unavailable" } },
      { status: 502 }
    );
  }
}
