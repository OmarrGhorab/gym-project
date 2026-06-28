"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import type { AppLocale } from "@/i18n/routing";
import { getAuthToken } from "@/lib/session";
import type { Attendance } from "@/lib/api/dashboard";
import type { MemberVisit } from "@/lib/api/dashboard";
import type { AttendanceViolation } from "@/lib/api/dashboard";
import type { AttendanceViolationRule } from "@/lib/api/dashboard";

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
  status?: "allowed" | "blocked" | "flagged" | string;
  alert_reason?: string | null;
  notes?: string | null;
};

export type ScanLocationInput = {
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
};

export type MemberVisitScanData = ScanLocationInput & {
  qr_token?: string | null;
  member_id?: number | null;
  phone?: string | null;
  name?: string | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
  notes?: string | null;
};

export type EmployeeScanData = ScanLocationInput & {
  qr_token?: string | null;
  employee_id?: number | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
  notes?: string | null;
};

export type AttendanceViolationReviewData = {
  status: "approved" | "dismissed";
  deduction_days?: string | null;
  deduction_amount?: string | null;
  notes?: string | null;
};

export type AttendanceViolationRuleData = {
  name?: string;
  description?: string | null;
  threshold_minutes?: number | null;
  deduction_days?: string;
  requires_admin_approval?: boolean;
  auto_apply_if_unreviewed?: boolean;
  is_active?: boolean;
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

export async function updateMemberVisit(
  id: number,
  data: Omit<MemberVisitFormData, "member_id">,
  locale: AppLocale
): Promise<MemberVisit> {
  const payload = await attendanceFetch(`/member-visits/${id}`, {
    method: "PUT",
    body: JSON.stringify(cleanPayload(data)),
  });

  revalidateMemberVisit(locale);

  return payload.data as MemberVisit;
}

export async function deleteMemberVisit(
  id: number,
  locale: AppLocale
): Promise<void> {
  await attendanceFetch(`/member-visits/${id}`, {
    method: "DELETE",
  });

  revalidateMemberVisit(locale);
}

export async function checkInMemberVisit(
  data: MemberVisitScanData,
  locale: AppLocale
): Promise<MemberVisit> {
  const payload = await attendanceFetch("/member-visits/check-in", {
    method: "POST",
    body: JSON.stringify(cleanPayload(data)),
  });

  revalidateMemberVisit(locale, data.member_id);

  return payload.data as MemberVisit;
}

export async function checkOutMemberVisit(
  data: MemberVisitScanData,
  locale: AppLocale
): Promise<MemberVisit> {
  const payload = await attendanceFetch("/member-visits/check-out", {
    method: "POST",
    body: JSON.stringify(cleanPayload(data)),
  });

  revalidateMemberVisit(locale, data.member_id);

  return payload.data as MemberVisit;
}

export async function checkInEmployeeAttendance(
  data: EmployeeScanData,
  locale: AppLocale
): Promise<Attendance> {
  const payload = await attendanceFetch("/attendance/check-in", {
    method: "POST",
    body: JSON.stringify(cleanPayload(data)),
  });

  revalidateAttendance(locale);
  revalidatePath(`/${locale}/teams`);
  revalidatePath(`/${locale}/trainers`);
  revalidatePath(`/${locale}/payroll`);

  return payload.data as Attendance;
}

export async function checkOutEmployeeAttendance(
  data: EmployeeScanData,
  locale: AppLocale
): Promise<Attendance> {
  const payload = await attendanceFetch("/attendance/check-out", {
    method: "POST",
    body: JSON.stringify(cleanPayload(data)),
  });

  revalidateAttendance(locale);
  revalidatePath(`/${locale}/teams`);
  revalidatePath(`/${locale}/trainers`);
  revalidatePath(`/${locale}/payroll`);

  return payload.data as Attendance;
}

export async function reviewAttendanceViolation(
  id: number,
  data: AttendanceViolationReviewData,
  locale: AppLocale
): Promise<AttendanceViolation> {
  const payload = await attendanceFetch(`/attendance/violations/${id}`, {
    method: "PUT",
    body: JSON.stringify(cleanPayload(data)),
  });

  revalidateAttendance(locale);
  revalidatePath(`/${locale}/payroll`);

  return payload.data as AttendanceViolation;
}

export async function updateAttendanceViolationRule(
  id: number,
  data: AttendanceViolationRuleData,
  locale: AppLocale
): Promise<AttendanceViolationRule> {
  const payload = await attendanceFetch(`/attendance/violation-rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(cleanPayload(data)),
  });

  revalidateAttendance(locale);
  revalidatePath(`/${locale}/payroll`);

  return payload.data as AttendanceViolationRule;
}

function cleanPayload<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== "")
  );
}

function revalidateMemberVisit(locale: AppLocale, memberId?: number | null) {
  revalidatePath(`/${locale}/attendance`);
  if (memberId) {
    revalidatePath(`/${locale}/members/${memberId}`);
  }
  revalidateTag("member-visits", "max");
}

function revalidateAttendance(locale: AppLocale) {
  revalidatePath(`/${locale}/attendance`);
  revalidatePath(`/${locale}/reports`);
  revalidateTag("attendance", "max");
  revalidateTag("reports", "max");
}
