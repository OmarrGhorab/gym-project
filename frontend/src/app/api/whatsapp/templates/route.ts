import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

export async function GET() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ data: { templates: {} } }, { status: 401 });
  }

  const response = await fetch(`${API_BASE_URL}/settings/whatsapp-templates`, {
    cache: "no-store",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });

  return NextResponse.json(await response.json().catch(() => ({ data: { templates: {} } })), {
    status: response.status,
  });
}
