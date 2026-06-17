import type { NextRequest, NextResponse } from "next/server";
import { routing, type AppLocale } from "@/i18n/routing";

const GOOGLE_AUTH_LOCALE_COOKIE = "google_auth_locale";
const GOOGLE_AUTH_LOCALE_MAX_AGE = 300;

export function getGoogleAuthLocale(request: NextRequest): AppLocale {
  return normalizeLocale(request.cookies.get(GOOGLE_AUTH_LOCALE_COOKIE)?.value);
}

export function getRequestedGoogleAuthLocale(request: Request): AppLocale {
  return normalizeLocale(new URL(request.url).searchParams.get("locale"));
}

export function setGoogleAuthLocale(
  response: NextResponse,
  locale: AppLocale
) {
  response.cookies.set(GOOGLE_AUTH_LOCALE_COOKIE, locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GOOGLE_AUTH_LOCALE_MAX_AGE,
  });
}

export function clearGoogleAuthLocale(response: NextResponse) {
  response.cookies.delete(GOOGLE_AUTH_LOCALE_COOKIE);
}

function normalizeLocale(locale: string | null | undefined): AppLocale {
  return routing.locales.includes(locale as AppLocale)
    ? (locale as AppLocale)
    : routing.defaultLocale;
}
