"use server";

import { revalidatePath } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";
import type { Member } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";

export type MemberFormData = {
  name: string;
  phone: string;
  email?: string;
  gender?: "male" | "female";
  birth_date?: string;
  national_id?: string;
  join_date?: string;
  notes?: string;
  status?: "active" | "inactive";
};

async function membersFetch(path: string, options: RequestInit = {}) {
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
    const errorMessage =
      ((payload.error as { message?: string })?.message) ??
      (payload.message as string) ??
      response.statusText;

    throw new Error(errorMessage);
  }

  return payload;
}

export async function createMember(
  data: MemberFormData,
  locale: AppLocale
): Promise<Member> {
  const payload = await membersFetch("/members", {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidatePath(`/${locale}/members`);

  return payload.data as Member;
}

export async function updateMember(
  id: number,
  data: MemberFormData,
  locale: AppLocale
): Promise<Member> {
  const payload = await membersFetch(`/members/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

  revalidatePath(`/${locale}/members`);
  revalidatePath(`/${locale}/members/${id}`);

  return payload.data as Member;
}

export async function deactivateMember(
  id: number,
  locale: AppLocale
): Promise<Member> {
  const payload = await membersFetch(`/members/${id}`, {
    method: "DELETE",
  });

  revalidatePath(`/${locale}/members`);
  revalidatePath(`/${locale}/members/${id}`);

  return payload.data as Member;
}
