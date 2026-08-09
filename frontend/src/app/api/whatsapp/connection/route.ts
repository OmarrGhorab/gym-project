import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

const disconnected = {
  data: { configured: false, connected: false, enabled: false, number: null, queued: 0, state: "unknown" },
};

/** Polled by the settings page to show whether the gym's number is linked. */
export async function GET() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json(disconnected, { status: 401 });
  }

  const response = await fetch(`${API_BASE_URL}/settings/whatsapp/connection`, {
    cache: "no-store",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });

  return NextResponse.json(await response.json().catch(() => disconnected), { status: response.status });
}
