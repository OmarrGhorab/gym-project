import { NextResponse } from "next/server";
import { buildApiUrl } from "@/app/api/auth/_lib";

const MEDIA_CACHE_CONTROL = "private, no-store, no-cache, must-revalidate, max-age=0";

export function isValidRouteId(id: string) {
  return /^[1-9]\d*$/.test(id);
}

export async function proxyMedia(path: string, token: string) {
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
    const contentLength = response.headers.get("content-length");

    if (contentType) headers.set("content-type", contentType);
    if (contentLength) headers.set("content-length", contentLength);
    headers.set("cache-control", MEDIA_CACHE_CONTROL);
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
