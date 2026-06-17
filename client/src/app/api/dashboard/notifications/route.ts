import { NextResponse } from "next/server";
import { buildApiUrl } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

export async function GET(request: Request) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json(
      {
        error: {
          code: "unauthorized",
          message: "Unauthorized",
        },
      },
      { status: 401 }
    );
  }

  const { search } = new URL(request.url);

  try {
    const response = await fetch(buildApiUrl("/notifications", search), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));

    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "notifications_unavailable",
          message: "Notifications are unavailable right now.",
        },
      },
      { status: 502 }
    );
  }
}
