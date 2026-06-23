"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import { MemberActionError } from "@/lib/member-action-error";
import { getAuthToken } from "@/lib/session";
import type { Member } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";

export type MemberFormData = {
  name: string;
  phone: string;
  email?: string;
  gender?: "male" | "female";
  national_id?: string;
  join_date?: string;
  notes?: string;
  status?: "active" | "inactive";
  photo?: File;
  subscription?: {
    plan_id: number;
    start_date: string;
    end_date: string;
    discount?: string;
    payment: {
      amount: string;
      method: string;
      paid_at?: string;
    };
  };
};

export type SubscriptionCreateData = {
  member_id: number;
  plan_id: number;
  start_date: string;
  end_date?: string;
  discount?: string;
  payment: {
    amount: string;
    method: string;
    paid_at?: string;
  };
};

async function membersFetch(path: string, options: RequestInit = {}) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Unauthorized");
  }

  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
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

    const error = new MemberActionError(errorMessage, details);
    if (details && Object.keys(details).length > 0) {
      error.message = JSON.stringify({
        message: errorMessage,
        details,
      });
    }

    throw error;
  }

  return payload;
}

export async function createMember(
  data: MemberFormData,
  locale: AppLocale
): Promise<Member> {
  const photo = data.photo;
  const memberData = stripPhoto(data);
  const payload = await membersFetch("/members", {
    method: "POST",
    body: JSON.stringify(memberData),
  });
  const member = payload.data as Member;

  if (photo) {
    await uploadMemberPhoto(member.id, photo, locale);
  } else {
    revalidateMembers(locale, member.id);
  }

  return member;
}

export async function getMemberForEdit(id: number): Promise<Member> {
  const payload = await membersFetch(`/members/${id}`, {
    method: "GET",
  });

  return payload.data as Member;
}

export async function updateMember(
  id: number,
  data: MemberFormData,
  locale: AppLocale
): Promise<Member> {
  const photo = data.photo;
  const memberData = stripPhoto(data);
  const payload = await membersFetch(`/members/${id}`, {
    method: "PUT",
    body: JSON.stringify(memberData),
  });

  if (photo) {
    await uploadMemberPhoto(id, photo, locale);
  } else {
    revalidateMembers(locale, id);
  }

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
  revalidatePath(`/${locale}/subscriptions`);
  revalidateTag("members", "max");
  revalidateTag(`member-${id}`, "max");
  revalidateTag("subscriptions", "max");

  return payload.data as Member;
}

export async function uploadMemberPhoto(
  id: number,
  photo: File,
  locale: AppLocale
): Promise<Member> {
  const formData = new FormData();
  formData.set("photo", photo);

  const payload = await membersFetch(`/members/${id}/photo`, {
    method: "POST",
    body: formData,
  });

  revalidateMembers(locale, id);

  return payload.data as Member;
}

export async function stopSubscription(
  id: number,
  locale: AppLocale
): Promise<Record<string, unknown>> {
  const payload = await membersFetch(`/subscriptions/${id}/stop`, {
    method: "POST",
  });

  revalidatePath(`/${locale}/members`);
  revalidatePath(`/${locale}/subscriptions`);
  revalidateTag("members", "max");
  revalidateTag("subscriptions", "max");

  return payload.data as Record<string, unknown>;
}

function stripPhoto(data: MemberFormData): Omit<MemberFormData, "photo"> {
  const { photo, ...memberData } = data;
  void photo;
  return memberData;
}

function revalidateMembers(locale: AppLocale, memberId?: number) {
  revalidatePath(`/${locale}/members`);
  if (memberId) {
    revalidatePath(`/${locale}/members/${memberId}`);
  }
  revalidatePath(`/${locale}/subscriptions`);
  revalidateTag("members", "max");
  if (memberId) {
    revalidateTag(`member-${memberId}`, "max");
  }
  revalidateTag("subscriptions", "max");
}
