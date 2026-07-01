import { NextResponse } from "next/server";

import { buildApiUrl } from "../../_lib";

export async function GET(request: Request) {
  const response = await fetch(buildApiUrl("/auth/google/redirect"), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    redirect: "manual",
  });
  const location = response.headers.get("location");

  if (!location) {
    const loginUrl = new URL("/auth/v2/login", request.url);
    loginUrl.searchParams.set("auth_error", "Google sign in is unavailable. Please try again.");

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(location);
}
