import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

const noCode = { data: { qr: null, state: "unknown" } };

/**
 * The pairing QR for linking the gym's WhatsApp number.
 *
 * Never cached: WhatsApp rotates the code roughly every 20 seconds, and a
 * cached one cannot be scanned.
 */
export async function GET() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json(noCode, { status: 401 });
  }

  const response = await fetch(`${API_BASE_URL}/settings/whatsapp/qr`, {
    cache: "no-store",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });

  return NextResponse.json(await response.json().catch(() => noCode), { status: response.status });
}
