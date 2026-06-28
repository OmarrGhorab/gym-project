import { NextResponse } from "next/server";

import { defaultLocale, getLocaleDirection, isAppLocale, localeCookieName } from "@/i18n/config";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { locale?: string };
  const locale = isAppLocale(body.locale) ? body.locale : defaultLocale;
  const response = NextResponse.json({
    data: {
      locale,
      direction: getLocaleDirection(locale),
    },
  });

  response.cookies.set(localeCookieName, locale, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
