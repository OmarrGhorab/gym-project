"use server";

import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { AUTH_TOKEN_COOKIE } from "@/lib/auth-cookie";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import type { AppLocale } from "@/i18n/routing";

export async function logoutAction(locale: AppLocale) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value;

  if (token) {
    try {
      await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
    } catch {
      // Backend unreachable — still clear local session
    }

    cookieStore.delete(AUTH_TOKEN_COOKIE);
  }

  redirect({ href: "/login", locale });
}
