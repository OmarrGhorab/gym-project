import { cookies } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import { AUTH_TOKEN_COOKIE } from "@/lib/auth-cookie";
import type { AppLocale } from "@/i18n/routing";
import type { DashboardRole, DashboardUser } from "@/components/dashboard/types";

type CurrentUserResponse = {
  data?: {
    id: number;
    name: string;
    email: string;
    roles?: string[];
  };
};

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

export async function getCurrentUser(): Promise<DashboardUser | null> {
  const token = await getAuthToken();

  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as CurrentUserResponse;
    const user = payload.data;

    if (!user?.name || !user.email) return null;

    return {
      name: user.name,
      email: user.email,
      role: mapDashboardRole(user.roles),
    };
  } catch {
    return null;
  }
}

export async function redirectIfAuthenticated(locale: AppLocale) {
  const token = await getAuthToken();

  if (token) {
    redirect({ href: "/", locale });
  }
}

function mapDashboardRole(roles: string[] = []): DashboardRole {
  const normalizedRoles = roles.map((role) => role.toLowerCase());

  if (normalizedRoles.some((role) => ["owner", "super-admin", "super_admin"].includes(role))) {
    return "owner";
  }

  if (normalizedRoles.some((role) => ["admin", "manager"].includes(role))) {
    return "admin";
  }

  return "staff";
}
