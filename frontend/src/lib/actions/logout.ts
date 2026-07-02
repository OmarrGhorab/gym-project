"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { AUTH_TOKEN_COOKIE } from "@/lib/auth-cookie";

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_TOKEN_COOKIE)?.value;

  if (token) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
    } catch {
      // Backend unreachable; still clear the local session.
    }

    cookieStore.delete(AUTH_TOKEN_COOKIE);
  }

  redirect("/auth/v2/login");
}
