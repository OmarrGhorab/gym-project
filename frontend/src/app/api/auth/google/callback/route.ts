import { NextResponse } from "next/server";

import { AUTH_TOKEN_COOKIE } from "@/lib/auth-cookie";

import { buildApiUrl, getCookieOptions } from "../../_lib";

type SocialAuthPayload = {
  data?: {
    token?: string;
  };
  error?: {
    message?: string;
  };
  message?: string;
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const response = await fetch(buildApiUrl("/auth/google/callback", requestUrl.search), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as SocialAuthPayload;

  if (!response.ok || !payload.data?.token) {
    const loginUrl = new URL("/auth/v2/login", request.url);
    loginUrl.searchParams.set("auth_error", payload.error?.message ?? payload.message ?? "Google sign in failed.");

    return NextResponse.redirect(loginUrl);
  }

  const redirectResponse = NextResponse.redirect(new URL("/dashboard/default", request.url));
  redirectResponse.cookies.set(AUTH_TOKEN_COOKIE, payload.data.token, getCookieOptions(true));

  return redirectResponse;
}
