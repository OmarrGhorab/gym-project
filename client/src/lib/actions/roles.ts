"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import type { AppLocale } from "@/i18n/routing";
import type { Role } from "@/lib/api/dashboard";
import { getAuthToken } from "@/lib/session";

export type RoleFormData = {
  name: string;
  permissions: string[];
};

async function rolesFetch(path: string, options: RequestInit = {}) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const details =
      (payload.error as { details?: Record<string, string[]> } | undefined)
        ?.details ?? undefined;
    const errorMessage =
      ((payload.error as { message?: string })?.message) ??
      (payload.message as string) ??
      response.statusText;

    if (details && Object.keys(details).length > 0) {
      throw new Error(JSON.stringify({ message: errorMessage, details }));
    }

    throw new Error(errorMessage);
  }

  return payload;
}

export async function createRole(
  data: RoleFormData,
  locale: AppLocale
): Promise<Role> {
  const payload = await rolesFetch("/roles", {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidateRoles(locale);

  return payload.data as Role;
}

export async function updateRole(
  id: number,
  data: RoleFormData,
  locale: AppLocale
): Promise<Role> {
  const payload = await rolesFetch(`/roles/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

  revalidateRoles(locale);

  return payload.data as Role;
}

export async function deleteRole(
  id: number,
  locale: AppLocale
): Promise<void> {
  await rolesFetch(`/roles/${id}`, {
    method: "DELETE",
  });

  revalidateRoles(locale);
}

function revalidateRoles(locale: AppLocale) {
  revalidatePath(`/${locale}/roles`);
  revalidateTag("roles", "max");
}
