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

  const payload = scanPayload(input, ["qr_token", "member_id", "phone", "name", "notes"]);

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

  const payload = scanPayload(input, ["qr_token", "employee_id", "notes"]);

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

async function mutateScan(
  path: string,
  payload: Record<string, unknown>,
  successMessage: string,
  method: "POST" | "PUT",
  values: Record<string, string>,
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
      errors: {},
      values,
    };
  }

  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/payroll");

  return {
    ok: true,
    message: successMessage,
    errors: {},
    values,
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
