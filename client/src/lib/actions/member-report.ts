"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import type { AppLocale } from "@/i18n/routing";
import { getAuthToken } from "@/lib/session";

type Payload = Record<string, unknown>;

async function postMemberReportItem(
  memberId: number,
  path: string,
  payload: Payload,
  locale: AppLocale
) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(`${API_BASE_URL}/members/${memberId}/${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; details?: Record<string, string[]> };
    message?: string;
  };

  if (!response.ok) {
    const details = data.error?.details;
    const message = data.error?.message ?? data.message ?? response.statusText;
    if (details && Object.keys(details).length > 0) {
      throw new Error(JSON.stringify({ message, details }));
    }
    throw new Error(message);
  }

  revalidatePath(`/${locale}/members/${memberId}`);
  revalidatePath(`/${locale}/members`);
  revalidateTag(`member-${memberId}`, "max");

  return data;
}

export async function createMemberProgress(
  memberId: number,
  payload: Payload,
  locale: AppLocale
) {
  return postMemberReportItem(memberId, "progress", payload, locale);
}

export async function createMemberWorkoutPlan(
  memberId: number,
  payload: Payload,
  locale: AppLocale
) {
  return postMemberReportItem(memberId, "workout-plans", payload, locale);
}

export async function createMemberNutritionPlan(
  memberId: number,
  payload: Payload,
  locale: AppLocale
) {
  return postMemberReportItem(memberId, "nutrition-plans", payload, locale);
}

export async function createMemberDocument(
  memberId: number,
  payload: Payload,
  locale: AppLocale
) {
  return postMemberReportItem(memberId, "documents", payload, locale);
}

export async function createMemberBooking(
  memberId: number,
  payload: Payload,
  locale: AppLocale
) {
  return postMemberReportItem(memberId, "bookings", payload, locale);
}
