"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

/**
 * A scan the desk has to decide on before it counts.
 *
 * Carried back to the client so the operator is asked at the moment of the
 * scan, rather than having to notice a row further down the page.
 */
export type PendingVisitReview = {
  id: number;
  memberName: string | null;
  planName: string | null;
  planEndDate: string | null;
  reason: string;
  sessionsRemaining: number | null;
  sessionsTotal: number | null;
  visitsThisMonth: number | null;
};

export type AttendanceActionResult =
  | {
      ok: true;
      message: string;
      errors: Partial<Record<string, string[]>>;
      values: Record<string, string>;
      review?: PendingVisitReview | null;
    }
  | {
      ok: false;
      message: string;
      errors: Partial<Record<string, string[]>>;
      values: Record<string, string>;
      review?: null;
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

export async function reviewMemberVisit(
  _previousState: AttendanceActionResult,
  input: FormData,
): Promise<AttendanceActionResult> {
  const values = getFormValues(input);
  const visitId = Number(input.get("member_visit_id"));
  const decision = String(input.get("decision"));

  if (!Number.isInteger(visitId) || visitId <= 0 || !["approved", "dismissed"].includes(decision)) {
    return { ok: false, message: "Invalid member visit review.", errors: {}, values };
  }

  return mutateScan(
    `/member-visits/${visitId}/review`,
    { decision },
    decision === "approved" ? "Member check-in approved." : "Member check-in dismissed.",
    "POST",
    values,
  );
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
    check_in: parsed.data.check_in,
    check_out: parsed.data.check_out,
    date: parsed.data.date,
    employee_id: parsed.data.employee_id,
    notes: parsed.data.notes,
    shift_id: parsed.data.shift_id,
    status: parsed.data.status,
  };

  if (attendanceId !== null) {
    return mutateScan(`/attendance/${attendanceId}`, payload, "Attendance correction saved.", "PUT", values);
  }

  return mutateScan("/attendance", payload, "Manual attendance record created.", "POST", values);
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
        id?: number | null;
        status?: string | null;
        alert_reason?: string | null;
        plan_name?: string | null;
        plan_end_date?: string | null;
        member?: {
          name?: string | null;
          visits_this_month?: number | null;
        } | null;
        subscription?: {
          sessions_remaining?: number | null;
          sessions_total?: number | null;
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

  const message = typeof result.message === "string" && result.message.trim() ? result.message : successMessage;

  const visit = result.data;
  const review: PendingVisitReview | null =
    visit?.status === "pending_review" && typeof visit.id === "number"
      ? {
          id: visit.id,
          memberName: visit.member?.name ?? null,
          planName: visit.plan_name ?? null,
          planEndDate: visit.plan_end_date ?? null,
          reason: visit.alert_reason ?? message,
          sessionsRemaining: visit.subscription?.sessions_remaining ?? null,
          sessionsTotal: visit.subscription?.sessions_total ?? null,
          visitsThisMonth: visit.member?.visits_this_month ?? null,
        }
      : null;

  return {
    ok: true,
    message,
    errors: {},
    values,
    review,
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
  shift_id: optionalFormNumber,
  status: z.enum(["present", "absent", "excused"]),
});

function getFormValues(input: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(input.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
}
