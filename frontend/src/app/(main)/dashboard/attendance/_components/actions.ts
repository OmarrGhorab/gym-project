"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

export type AttendanceActionResult =
  | {
      ok: true;
      message: string;
      errors: Partial<Record<string, string[]>>;
      values: Record<string, string>;
    }
  | {
      ok: false;
      message: string;
      errors: Partial<Record<string, string[]>>;
      values: Record<string, string>;
    };

export async function scanMemberVisit(
  _previousState: AttendanceActionResult,
  input: FormData,
): Promise<AttendanceActionResult> {
  const values = getFormValues(input);
  const parsed = scanMemberSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const payload = scanPayload(input, [
    "qr_token",
    "member_id",
    "phone",
    "name",
    "notes",
    "scan_method",
    "subscription_addon_id",
  ]);

  return mutateScan("/member-visits/check-in", payload, "Member check-in recorded.", "POST", values);
}

export async function scanStaffAttendance(
  _previousState: AttendanceActionResult,
  input: FormData,
): Promise<AttendanceActionResult> {
  const direction = String(input.get("direction") || "check-in");
  const values = getFormValues(input);
  const parsed = scanStaffSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const payload = scanPayload(input, ["qr_token", "employee_id", "attendance_date", "notes", "scan_method"]);

  return mutateScan(
    direction === "check-out" ? "/attendance/check-out" : "/attendance/check-in",
    payload,
    direction === "check-out" ? "Staff check-out recorded." : "Staff check-in recorded.",
    "POST",
    values,
  );
}

export async function createManualAttendance(
  _previousState: AttendanceActionResult,
  input: FormData,
): Promise<AttendanceActionResult> {
  const values = getFormValues(input);
  const parsed = manualAttendanceSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const attendanceId = nullableNumber(input.get("attendance_id"));
  const payload = {
    // An unchecked box submits nothing, so absence means "waive the penalty".
    apply_penalty: parsed.data.apply_penalty,
    approval_status: parsed.data.approval_status,
    check_in: parsed.data.check_in,
    check_out: parsed.data.check_out,
    date: parsed.data.date,
    employee_id: parsed.data.employee_id,
    notes: parsed.data.notes,
    schedule_status: parsed.data.schedule_status,
    shift_id: parsed.data.shift_id,
    status: parsed.data.status,
  };

  if (attendanceId !== null) {
    return mutateScan(`/attendance/${attendanceId}`, payload, "Attendance correction saved.", "PUT", values);
  }

  return mutateScan("/attendance", payload, "Manual attendance record created.", "POST", values);
}

export async function reviewAttendanceViolation(
  _previousState: AttendanceActionResult,
  input: FormData,
): Promise<AttendanceActionResult> {
  const values = getFormValues(input);
  const parsed = reviewWarningSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const id = Number(input.get("id"));
  const payload = {
    deduction_amount: parsed.data.deduction_amount,
    deduction_days: parsed.data.deduction_days,
    notes: parsed.data.notes,
    status: parsed.data.status,
  };

  return mutateScan(`/attendance/violations/${id}`, payload, "Attendance warning reviewed.", "PUT", values);
}

export async function createOvertimeShift(
  _previousState: AttendanceActionResult,
  input: FormData,
): Promise<AttendanceActionResult> {
  const values = getFormValues(input);
  const parsed = overtimeShiftSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const payload = {
    covering_for_employee_id: parsed.data.covering_for_employee_id,
    date: parsed.data.date,
    employee_id: parsed.data.employee_id,
    employee_shift_id: parsed.data.employee_shift_id,
    notes: parsed.data.notes,
  };

  return mutateScan("/overtime-shifts", payload, "Overtime shift recorded.", "POST", values);
}

export async function reviewOvertimeShift(
  _previousState: AttendanceActionResult,
  input: FormData,
): Promise<AttendanceActionResult> {
  const values = getFormValues(input);
  const parsed = reviewOvertimeSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const payload: Record<string, unknown> = {
    decision: parsed.data.decision,
    notes: parsed.data.notes,
  };

  if (parsed.data.decision === "approved") {
    payload.bonus_amount = parsed.data.bonus_amount;
  }

  const messages = {
    approved: "Overtime bonus approved. Add it to the salary in Payroll.",
    rejected: "Overtime shift rejected.",
    settled: "Overtime bonus marked as added to the salary.",
  } as const;

  return mutateScan(`/overtime-shifts/${parsed.data.id}`, payload, messages[parsed.data.decision], "PUT", values);
}

async function mutateScan(
  path: string,
  payload: Record<string, unknown>,
  successMessage: string,
  method: "POST" | "PUT",
  values: Record<string, string>,
): Promise<AttendanceActionResult> {
  let result: Awaited<
    ReturnType<
      typeof serverApiFetch<{
        schedule_status?: string | null;
        approval_status?: string | null;
        status?: string | null;
        subscription?: {
          sessions_remaining?: number | null;
        } | null;
        subscription_addon?: {
          sessions_remaining?: number | null;
        } | null;
      }>
    >
  >;

  try {
    result = await serverApiFetch(path, {
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
      errors: {},
      values,
    };
  }

  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/payroll");

  const apiMessage = typeof result.message === "string" && result.message.trim() ? result.message : successMessage;
  const message =
    result.data?.schedule_status === "off_shift"
      ? "Recorded with warning: this scan is outside the assigned shift."
      : apiMessage;

  return {
    ok: true,
    message,
    errors: {},
    values,
  };
}

function scanPayload(input: FormData, fields: string[]) {
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    const value = input.get(field);
    if (value === null || String(value).trim() === "" || String(value).trim() === "none") {
      continue;
    }

    if (field.endsWith("_id")) {
      const id = Number(value);
      if (!Number.isFinite(id) || id <= 0) {
        continue;
      }
      payload[field] = id;
      continue;
    }

    payload[field] = String(value);
  }

  for (const field of ["latitude", "longitude", "accuracy_meters"]) {
    const value = nullableNumber(input.get(field));
    if (value !== null) {
      payload[field] = value;
    }
  }

  return payload;
}

function nullableNumber(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") {
    return null;
  }

  return Number(value);
}

const scanLookupSchema = z.object({
  direction: z.enum(["check-in", "check-out"]).default("check-in"),
  member_id: z.preprocess(
    (value) => (String(value ?? "").trim() === "" ? null : value),
    z.coerce.number().int().positive().nullable(),
  ),
  name: z.preprocess((value) => (String(value ?? "").trim() === "" ? null : value), z.string().nullable()),
  phone: z.preprocess((value) => (String(value ?? "").trim() === "" ? null : value), z.string().nullable()),
  qr_token: z.preprocess((value) => (String(value ?? "").trim() === "" ? null : value), z.string().nullable()),
});

const scanMemberSchema = scanLookupSchema.superRefine((value, context) => {
  if (!value.qr_token && !value.member_id && !value.phone && !value.name) {
    context.addIssue({
      code: "custom",
      message: "Provide a QR token, member ID, phone number, or name.",
      path: ["qr_token"],
    });
  }
});

const scanStaffSchema = z
  .object({
    direction: z.enum(["check-in", "check-out"]).default("check-in"),
    employee_id: z.preprocess(
      (value) => (String(value ?? "").trim() === "" ? null : value),
      z.coerce.number().int().positive().nullable(),
    ),
    qr_token: z.preprocess((value) => (String(value ?? "").trim() === "" ? null : value), z.string().nullable()),
  })
  .superRefine((value, context) => {
    if (!value.qr_token && !value.employee_id) {
      context.addIssue({
        code: "custom",
        message: "Provide an employee QR token or employee selector value.",
        path: ["qr_token"],
      });
    }
  });

const optionalFormString = z.preprocess((value) => {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}, z.string().nullable());

const optionalFormNumber = z.preprocess((value) => {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}, z.coerce.number().nullable());

const manualAttendanceSchema = z.object({
  // Checkbox: present in the form data only when ticked.
  apply_penalty: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean()),
  approval_status: z.preprocess(
    (value) => (String(value ?? "").trim() === "" ? null : value),
    z.enum(["approved", "pending", "dismissed"]).nullable(),
  ),
  check_in: z.preprocess(
    (value) => (String(value ?? "").trim() === "" ? null : value),
    z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
  ),
  check_out: z.preprocess(
    (value) => (String(value ?? "").trim() === "" ? null : value),
    z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
  ),
  date: z.string().date("Attendance date is required."),
  employee_id: z.coerce.number().int().min(1, "Employee is required."),
  notes: optionalFormString,
  schedule_status: z.preprocess(
    (value) => (String(value ?? "").trim() === "" ? null : value),
    z.enum(["on_shift", "late", "off_shift", "unassigned"]).nullable(),
  ),
  shift_id: optionalFormNumber,
  status: z.enum(["present", "late", "absent", "excused"]),
});

const overtimeShiftSchema = z.object({
  covering_for_employee_id: optionalFormNumber,
  date: z.string().date("Overtime date is required."),
  employee_id: z.coerce.number().int().min(1, "Select the employee taking the overtime shift."),
  employee_shift_id: optionalFormNumber,
  notes: optionalFormString,
});

const reviewOvertimeSchema = z
  .object({
    bonus_amount: optionalFormNumber,
    decision: z.enum(["approved", "rejected", "settled"]),
    id: z.coerce.number().int().min(1, "Overtime shift is required."),
    notes: optionalFormString,
  })
  .superRefine((value, context) => {
    if (value.decision === "approved" && (value.bonus_amount === null || value.bonus_amount < 0)) {
      context.addIssue({
        code: "custom",
        message: "Enter the bonus amount to approve this overtime shift.",
        path: ["bonus_amount"],
      });
    }
  });

const reviewWarningSchema = z.object({
  deduction_amount: optionalFormNumber,
  deduction_days: optionalFormNumber,
  id: z.coerce.number().int().min(1, "Warning is required."),
  notes: optionalFormString,
  status: z.enum(["approved", "dismissed"]),
});

function getFormValues(input: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(input.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
}
