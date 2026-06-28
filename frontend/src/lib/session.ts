import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { AUTH_TOKEN_COOKIE } from "@/lib/auth-cookie";

export type DashboardUser = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  permissions: string[];
};

type CurrentUserResponse = {
  data?: {
    id: number;
    name: string;
    email: string;
    roles?: string[];
    permissions?: string[];
  };
};

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

export async function getCurrentUser(): Promise<DashboardUser | null> {
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

    const payload = (await response.json()) as CurrentUserResponse;
    const user = payload.data;

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

export async function redirectIfAuthenticated() {
  const token = await getAuthToken();

  if (token) {
    redirect("/dashboard/default");
  }
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
