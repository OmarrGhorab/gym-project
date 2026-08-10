import "server-only";

import { cache } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { z } from "zod";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { AUTH_TOKEN_COOKIE } from "@/lib/auth-cookie";
import { firstAccessibleDashboardPath } from "@/lib/authorization";

export type DashboardUser = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  permissions: string[];
};

const currentUserResponseSchema = z.object({
  data: z
    .object({
      email: z.email(),
      id: z.number().int().positive(),
      name: z.string().trim().min(1),
      permissions: z.array(z.string()).optional(),
      roles: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function getAuthToken() {
  const cookieStore = await cookies();

  return cookieStore.get(AUTH_TOKEN_COOKIE)?.value ?? null;
}

export async function requireAuth() {
  const token = await getAuthToken();

  if (!token) {
    redirect("/auth/v2/login");
  }

  return token;
}

async function loadCurrentUser(): Promise<DashboardUser | null> {
  const token = await getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = currentUserResponseSchema.safeParse(await response.json());

    if (!payload.success) {
      return null;
    }

    const user = payload.data.data;

    if (!user?.name || !user.email) {
      return null;
    }

    return {
      id: String(user.id),
      name: user.name,
      email: user.email,
      avatar: "",
      role: mapDashboardRole(user.roles),
      permissions: user.permissions ?? [],
    };
  } catch {
    return null;
  }
}

export const getCurrentUser = cache(loadCurrentUser);

/**
 * Sends an already signed-in user to their dashboard instead of a login or
 * register page.
 *
 * The session is resolved rather than sniffed from the cookie: an expired or
 * revoked token still leaves the cookie in place, and bouncing on its mere
 * presence would strand that user on a dashboard that renders nothing, with the
 * login form unreachable. No user means no session, so the auth page renders and
 * signing in again overwrites the stale cookie.
 */
export async function redirectIfAuthenticated() {
  const user = await getCurrentUser();

  if (!user) {
    return;
  }

  // Land where signing in would have landed, not on a fixed page the user may
  // have no permission to see.
  const destination = firstAccessibleDashboardPath(user);

  redirect(destination === "/dashboard/[...not-found]" ? "/unauthorized" : destination);
}

function mapDashboardRole(roles: string[] = []) {
  const normalizedRoles = roles.map((role) => role.toLowerCase());

  if (normalizedRoles.some((role) => ["owner", "super-admin", "super_admin"].includes(role))) {
    return "owner";
  }

  if (normalizedRoles.some((role) => ["admin", "manager"].includes(role))) {
    return "admin";
  }

  return "staff";
}
