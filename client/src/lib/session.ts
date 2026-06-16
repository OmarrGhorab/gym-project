import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { AUTH_TOKEN_COOKIE } from "@/lib/auth-cookie";
import type { AppLocale } from "@/i18n/routing";

export async function getAuthToken() {
  const cookieStore = await cookies();

  return cookieStore.get(AUTH_TOKEN_COOKIE)?.value ?? null;
}

export async function requireAuth(locale: AppLocale) {
  const token = await getAuthToken();

  if (!token) {
    redirect({ href: "/login", locale });
  }

  return token;
}

export async function redirectIfAuthenticated(locale: AppLocale) {
  const token = await getAuthToken();

  if (token) {
    redirect({ href: "/", locale });
  }
}
