"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { ServerApiError, serverApiFetch } from "@/lib/api/server";

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

/**
 * What became of a scan, told the way the desk has to repeat it to the member:
 * whether they are in, on which plan, and what is left of it.
 *
 * `denied` is a refusal — the reason is the rule that stopped it. `dismissed` is
 * a duplicate the desk threw away: nothing was charged, and the member is still
 * on the visit they walked in on.
 */
export type ScanOutcomeKind = "allowed" | "denied" | "dismissed" | "flagged";

export type ScanOutcome = {
  addonName: string | null;
  addonSessionsRemaining: number | null;
  addonSessionsTotal: number | null;
  checkInAt: string | null;
  kind: ScanOutcomeKind;
  memberName: string | null;
  memberPhone: string | null;
  planEndDate: string | null;
  planName: string | null;
  planStartDate: string | null;
  planStatus: string | null;
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
      outcome?: ScanOutcome | null;
      review?: PendingVisitReview | null;
    }
  | {
      ok: false;
      message: string;
      errors: Partial<Record<string, string[]>>;
      values: Record<string, string>;
      outcome?: ScanOutcome | null;
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

  return mutateScan("/member-visits/check-in", payload, "Member check-in recorded.", "POST", values, {
    memberVisit: true,
  });
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
    { memberVisit: true },
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

type MemberVisitPayload = {
  id?: number | null;
  status?: string | null;
  alert_reason?: string | null;
  check_in_at?: string | null;
  plan_name?: string | null;
  plan_status?: string | null;
  plan_start_date?: string | null;
  plan_end_date?: string | null;
  plan_sessions_remaining?: number | null;
  plan_sessions_total?: number | null;
  member?: {
    name?: string | null;
    phone?: string | null;
    visits_this_month?: number | null;
  } | null;
  subscription?: {
    plan_name?: string | null;
    status?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    sessions_remaining?: number | null;
    sessions_total?: number | null;
  } | null;
  subscription_addon?: {
    plan_name?: string | null;
    sessions_remaining?: number | null;
    sessions_total?: number | null;
  } | null;
};

async function mutateScan(
  path: string,
  payload: Record<string, unknown>,
  successMessage: string,
  method: "POST" | "PUT",
  values: Record<string, string>,
  { memberVisit = false }: { memberVisit?: boolean } = {},
): Promise<AttendanceActionResult> {
  let result: Awaited<ReturnType<typeof serverApiFetch<MemberVisitPayload>>>;

  try {
    result = await serverApiFetch(path, {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed.";

    return {
      ok: false,
      message,
      errors: {},
      values,
      // A membership refusal answers with the plan it was judged against, so the
      // desk is shown why the door stayed shut and not just that it did.
      outcome: memberVisit ? deniedOutcome(error, message) : null,
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
    // A held scan is a question, not an outcome — the duplicate dialog asks it,
    // and the outcome panel follows the answer.
    outcome: memberVisit && review === null ? settledOutcome(visit, message) : null,
    review,
  };
}

/**
 * The visit as a panel. Returns null for anything that is not a member visit —
 * a staff scan shares this code path and has none of these fields.
 */
function settledOutcome(visit: MemberVisitPayload | undefined, message: string): ScanOutcome | null {
  const kind = outcomeKind(visit?.status);

  if (!visit || kind === null) {
    return null;
  }

  return {
    addonName: visit.subscription_addon?.plan_name ?? null,
    addonSessionsRemaining: visit.subscription_addon?.sessions_remaining ?? null,
    addonSessionsTotal: visit.subscription_addon?.sessions_total ?? null,
    checkInAt: visit.check_in_at ?? null,
    kind,
    memberName: visit.member?.name ?? null,
    memberPhone: visit.member?.phone ?? null,
    // plan_* is the visit's own subscription when it has one and the member's
    // latest when it does not, so a dismissed scan still names a plan.
    planEndDate: visit.subscription?.end_date ?? visit.plan_end_date ?? null,
    planName: visit.subscription?.plan_name ?? visit.plan_name ?? null,
    planStartDate: visit.subscription?.start_date ?? visit.plan_start_date ?? null,
    planStatus: visit.subscription?.status ?? visit.plan_status ?? null,
    reason: kind === "flagged" ? (visit.alert_reason ?? message) : message,
    sessionsRemaining: visit.subscription?.sessions_remaining ?? visit.plan_sessions_remaining ?? null,
    sessionsTotal: visit.subscription?.sessions_total ?? visit.plan_sessions_total ?? null,
    visitsThisMonth: visit.member?.visits_this_month ?? null,
  };
}

function outcomeKind(status: string | null | undefined): ScanOutcomeKind | null {
  switch (status) {
    case "allowed":
      return "allowed";
    case "flagged":
      return "flagged";
    // The only way a scan comes back blocked here is the desk dismissing it.
    case "blocked":
      return "dismissed";
    default:
      return null;
  }
}

const deniedContextSchema = z.object({
  member: z
    .object({
      name: z.string().nullish(),
      phone: z.string().nullish(),
      visits_this_month: z.number().nullish(),
    })
    .nullish(),
  plan_end_date: z.string().nullish(),
  plan_name: z.string().nullish(),
  plan_start_date: z.string().nullish(),
  plan_status: z.string().nullish(),
  sessions_remaining: z.number().nullish(),
  sessions_total: z.number().nullish(),
});

function deniedOutcome(error: unknown, message: string): ScanOutcome {
  const context = error instanceof ServerApiError ? deniedContextSchema.safeParse(error.context).data : undefined;

  // Membership details are a bonus: a network failure or a 500 still has to name
  // the reason on the same panel, rather than falling back to a toast the
  // operator has to notice.
  return {
    addonName: null,
    addonSessionsRemaining: null,
    addonSessionsTotal: null,
    checkInAt: null,
    kind: "denied",
    memberName: context?.member?.name ?? null,
    memberPhone: context?.member?.phone ?? null,
    planEndDate: context?.plan_end_date ?? null,
    planName: context?.plan_name ?? null,
    planStartDate: context?.plan_start_date ?? null,
    planStatus: context?.plan_status ?? null,
    reason: message,
    sessionsRemaining: context?.sessions_remaining ?? null,
    sessionsTotal: context?.sessions_total ?? null,
    visitsThisMonth: context?.member?.visits_this_month ?? null,
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
