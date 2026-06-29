"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export type AttendanceActionResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function scanMemberVisit(
  _previousState: AttendanceActionResult,
  input: FormData,
): Promise<AttendanceActionResult> {
  const direction = String(input.get("direction") || "check-in");
  const payload = scanPayload(input, ["qr_token", "member_id", "phone", "name", "notes"]);

  return mutateScan(
    direction === "check-out" ? "/member-visits/check-out" : "/member-visits/check-in",
    payload,
    direction === "check-out" ? "Member check-out recorded." : "Member check-in recorded.",
  );
}

export async function scanStaffAttendance(
  _previousState: AttendanceActionResult,
  input: FormData,
): Promise<AttendanceActionResult> {
  const direction = String(input.get("direction") || "check-in");
  const payload = scanPayload(input, ["qr_token", "employee_id", "notes"]);

  return mutateScan(
    direction === "check-out" ? "/attendance/check-out" : "/attendance/check-in",
    payload,
    direction === "check-out" ? "Staff check-out recorded." : "Staff check-in recorded.",
  );
}

export async function createManualAttendance(
  _previousState: AttendanceActionResult,
  input: FormData,
): Promise<AttendanceActionResult> {
  const payload = {
    approval_status: nullableString(input.get("approval_status")),
    check_in: nullableString(input.get("check_in")),
    check_out: nullableString(input.get("check_out")),
    date: String(input.get("date") || ""),
    employee_id: Number(input.get("employee_id")),
    notes: nullableString(input.get("notes")),
    schedule_status: nullableString(input.get("schedule_status")),
    shift_id: nullableNumber(input.get("shift_id")),
    status: String(input.get("status") || "present"),
  };

  return mutateScan("/attendance", payload, "Manual attendance record created.", "POST");
}

export async function reviewAttendanceViolation(
  _previousState: AttendanceActionResult,
  input: FormData,
): Promise<AttendanceActionResult> {
  const id = Number(input.get("id"));
  const payload = {
    deduction_amount: nullableNumber(input.get("deduction_amount")),
    deduction_days: nullableNumber(input.get("deduction_days")),
    notes: nullableString(input.get("notes")),
    status: String(input.get("status") || "dismissed"),
  };

  return mutateScan(`/attendance/violations/${id}`, payload, "Attendance warning reviewed.", "PUT");
}

async function mutateScan(
  path: string,
  payload: Record<string, unknown>,
  successMessage: string,
  method = "POST",
): Promise<AttendanceActionResult> {
  try {
    await serverApiFetch(path, {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Action failed.",
    };
  }

  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/payroll");

  return {
    ok: true,
    message: successMessage,
  };
}

function scanPayload(input: FormData, fields: string[]) {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    const value = input.get(field);
    if (value === null || String(value).trim() === "") {
      continue;
    }

    payload[field] = field.endsWith("_id") ? Number(value) : String(value);
  }

  for (const field of ["latitude", "longitude", "accuracy_meters"]) {
    const value = nullableNumber(input.get(field));
    if (value !== null) {
      payload[field] = value;
    }
  }

  return payload;
}

function nullableString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}

function nullableNumber(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") {
    return null;
  }

  return Number(value);
}
