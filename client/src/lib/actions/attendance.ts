"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import type { AppLocale } from "@/i18n/routing";
import { getAuthToken } from "@/lib/session";
import type { Attendance } from "@/lib/api/dashboard";
import type { MemberVisit } from "@/lib/api/dashboard";

export type AttendanceFormData = {
  employee_id: number;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  status: string;
  notes?: string | null;
};

export type MemberVisitFormData = {
  member_id: number;
  check_in_at?: string | null;
  check_out_at?: string | null;
  notes?: string | null;
};

async function attendanceFetch(path: string, options: RequestInit = {}) {
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

export async function createAttendance(
  data: AttendanceFormData,
  locale: AppLocale
): Promise<Attendance> {
  const payload = await attendanceFetch("/attendance", {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidateAttendance(locale);

  return payload.data as Attendance;
}

export async function updateAttendance(
  id: number,
  data: AttendanceFormData,
  locale: AppLocale
): Promise<Attendance> {
  const payload = await attendanceFetch(`/attendance/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

  revalidateAttendance(locale);

  return payload.data as Attendance;
}

export async function deleteAttendance(
  id: number,
  locale: AppLocale
): Promise<void> {
  await attendanceFetch(`/attendance/${id}`, {
    method: "DELETE",
  });

  revalidateAttendance(locale);
}

export async function createMemberVisit(
  data: MemberVisitFormData,
  locale: AppLocale
): Promise<MemberVisit> {
  const payload = await attendanceFetch("/member-visits", {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidatePath(`/${locale}/attendance`);
  revalidatePath(`/${locale}/members/${data.member_id}`);
  revalidateTag("member-visits", "max");

  return payload.data as MemberVisit;
}

function revalidateAttendance(locale: AppLocale) {
  revalidatePath(`/${locale}/attendance`);
  revalidatePath(`/${locale}/reports`);
  revalidateTag("attendance", "max");
  revalidateTag("reports", "max");
}
