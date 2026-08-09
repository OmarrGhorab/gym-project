import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

/** Unlinks the gym's WhatsApp number, forcing a fresh QR scan. */
export async function POST() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const response = await fetch(`${API_BASE_URL}/settings/whatsapp/logout`, {
    cache: "no-store",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    method: "POST",
  });

  return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
}
