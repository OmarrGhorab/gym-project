import { NextResponse } from "next/server";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

const formats = new Set(["xlsx", "pdf"]);

export async function GET(request: Request, context: RouteContext<"/api/members/[id]/report/export">) {
  const token = await getAuthToken();
  const { id } = await context.params;
  const format = new URL(request.url).searchParams.get("format") ?? "xlsx";

  if (!token) {
    return NextResponse.json({ error: { message: "Missing authentication token." } }, { status: 401 });
  }

  if (!formats.has(format)) {
    return NextResponse.json({ error: { message: "Invalid report export format." } }, { status: 422 });
  }

  const response = await fetch(`${API_BASE_URL}/members/${encodeURIComponent(id)}/report/export?format=${format}`, {
    headers: {
      Accept:
        format === "pdf"
          ? "application/pdf, application/json"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { error: { message: response.statusText } }, { status: response.status });
  }

  return new NextResponse(response.body, {
    headers: {
      "Content-Disposition":
        response.headers.get("Content-Disposition") ?? `attachment; filename="member-${id}-report.${format}"`,
      "Content-Type":
        response.headers.get("Content-Type") ??
        (format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    },
    status: response.status,
  });
}
