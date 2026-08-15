import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

/** Rebuilds the gateway's session, keeping the pairing so no one re-scans a QR. */
export async function POST() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const response = await fetch(`${API_BASE_URL}/settings/whatsapp/reconnect`, {
    cache: "no-store",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    method: "POST",
  });

  return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
}
