"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";
import { whatsappTemplateKeys } from "@/lib/whatsapp-templates";

export type SettingsActionResult = {
  ok: boolean;
  message: string;
  errors?: Partial<Record<string, string[]>>;
};

const settingsSchema = z.object({
  attendance_default_grace_minutes: z.coerce.number().int().min(0, "Grace minutes cannot be negative."),
  attendance_gym_latitude: z.coerce.number().min(-90).max(90).nullable(),
  attendance_gym_longitude: z.coerce.number().min(-180).max(180).nullable(),
  attendance_gym_radius_meters: z.coerce.number().int().min(1, "GPS radius must be at least 1 meter."),
  payroll_default_pay_day: z.coerce
    .number()
    .int()
    .min(1, "Pay day must be between 1 and 31.")
    .max(31, "Pay day must be between 1 and 31."),
  payroll_schedule_mode: z.enum(["fixed", "per_employee"]),
  payroll_clean_attendance_bonus_enabled: z.boolean(),
  payroll_clean_attendance_bonus_percentage: z.coerce
    .number()
    .min(0, "Clean-attendance bonus cannot be negative.")
    .max(100, "Clean-attendance bonus cannot exceed 100%."),
  payroll_coach_performance_bonus_enabled: z.boolean(),
  payroll_coach_performance_bonus_percentage: z.coerce
    .number()
    .min(0, "Coach-performance bonus cannot be negative.")
    .max(100, "Coach-performance bonus cannot exceed 100%."),
  reminder_days: z
    .array(z.coerce.number().int().min(0, "Reminder days cannot be negative."))
    .min(1, "Add at least one reminder day."),
  shifts_handover_auto_accept: z.boolean(),
  shifts_handover_auto_accept_on_match_only: z.boolean(),
  shifts_require_handover_to_open: z.boolean(),
});

const shiftSchema = z.object({
  ends_at: z.string().regex(/^\d{2}:\d{2}$/, "Choose a valid end time."),
  grace_minutes: z.coerce.number().int().min(0, "Grace minutes cannot be negative."),
  id: z.coerce.number().int().min(0),
  is_active: z.boolean(),
  name: z.string().trim().min(2, "Shift name must be at least 2 characters.").max(120, "Shift name is too long."),
  off_day_bonus_amount: z.coerce.number().min(0, "Off-day bonus cannot be negative."),
  off_day_bonus_enabled: z.boolean(),
  off_days: z.array(z.coerce.number().int().min(0).max(6)).max(7),
  starts_at: z.string().regex(/^\d{2}:\d{2}$/, "Choose a valid start time."),
});

const violationRuleUpdateSchema = z.object({
  auto_apply_if_unreviewed: z.boolean(),
  deduction_days: z.coerce.number().min(0, "Deduction days cannot be negative."),
  description: z.string().trim().max(1000, "Description is too long.").nullable(),
  id: z.coerce.number().int().positive("Rule is required."),
  is_active: z.boolean(),
  name: z.enum([
    "Late more than 15 minutes",
    "Late more than 30 minutes",
    "Late more than 60 minutes",
    "Absence without approval",
    "Leaving before shift end",
    "Attendance outside assigned shift",
  ]),
  requires_admin_approval: z.boolean(),
  threshold_minutes: z.coerce.number().int().min(0, "Threshold cannot be negative.").nullable(),
  warning_count_before_deduction: z.coerce.number().int().min(0, "Warning count cannot be negative."),
});

const violationRuleCreateSchema = violationRuleUpdateSchema.omit({ id: true });

function parseReminderDays(input: FormDataEntryValue | null) {
  return String(input ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function updateSettings(input: FormData): Promise<SettingsActionResult> {
  const parsed = settingsSchema.safeParse({
    attendance_default_grace_minutes: input.get("attendance.default_grace_minutes") || "0",
    attendance_gym_latitude: nullableNumber(input.get("attendance.gym_latitude")),
    attendance_gym_longitude: nullableNumber(input.get("attendance.gym_longitude")),
    attendance_gym_radius_meters: input.get("attendance.gym_radius_meters") || "150",
    payroll_default_pay_day: input.get("payroll.default_pay_day") || "30",
    payroll_schedule_mode: input.get("payroll.schedule_mode") || "fixed",
    payroll_clean_attendance_bonus_enabled:
      input.get("payroll.clean_attendance_bonus_enabled") === "on" ||
      input.get("payroll.clean_attendance_bonus_enabled") === "true",
    payroll_clean_attendance_bonus_percentage: input.get("payroll.clean_attendance_bonus_percentage") || "0",
    payroll_coach_performance_bonus_enabled:
      input.get("payroll.coach_performance_bonus_enabled") === "on" ||
      input.get("payroll.coach_performance_bonus_enabled") === "true",
    payroll_coach_performance_bonus_percentage: input.get("payroll.coach_performance_bonus_percentage") || "0",
    reminder_days: parseReminderDays(input.get("reminder_days")),
    shifts_handover_auto_accept:
      input.get("shifts.handover_auto_accept") === "on" || input.get("shifts.handover_auto_accept") === "true",
    shifts_handover_auto_accept_on_match_only:
      input.get("shifts.handover_auto_accept_on_match_only") === "on" ||
      input.get("shifts.handover_auto_accept_on_match_only") === "true",
    shifts_require_handover_to_open:
      input.get("shifts.require_handover_to_open") === "on" || input.get("shifts.require_handover_to_open") === "true",
  });

  if (!parsed.success) {
    return invalidResult("Please fix the highlighted settings fields.", parsed.error);
  }

  const payload = {
    attendance: {
      default_grace_minutes: parsed.data.attendance_default_grace_minutes,
      gym_latitude: parsed.data.attendance_gym_latitude,
      gym_longitude: parsed.data.attendance_gym_longitude,
      gym_radius_meters: parsed.data.attendance_gym_radius_meters,
    },
    payroll: {
      clean_attendance_bonus_enabled: parsed.data.payroll_clean_attendance_bonus_enabled,
      clean_attendance_bonus_percentage: parsed.data.payroll_clean_attendance_bonus_percentage,
      coach_performance_bonus_enabled: parsed.data.payroll_coach_performance_bonus_enabled,
      coach_performance_bonus_percentage: parsed.data.payroll_coach_performance_bonus_percentage,
      default_pay_day: parsed.data.payroll_default_pay_day,
      schedule_mode: parsed.data.payroll_schedule_mode,
    },
    shifts: {
      handover_auto_accept: parsed.data.shifts_handover_auto_accept,
      handover_auto_accept_on_match_only: parsed.data.shifts_handover_auto_accept_on_match_only,
      require_handover_to_open: parsed.data.shifts_require_handover_to_open,
    },
    reminder_days: parsed.data.reminder_days,
  };

  try {
    await serverApiFetch("/settings", {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    });
  } catch (error) {
    return errorResult(error, "Could not save settings.");
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/infrastructure");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/academy/staff");
  revalidatePath("/dashboard/payroll");

  return { ok: true, message: "Settings saved.", errors: {} };
}

export async function saveWhatsAppTemplates(input: FormData): Promise<SettingsActionResult> {
  const parsed = z
    .object(Object.fromEntries(whatsappTemplateKeys.map((key) => [key, z.string().trim().min(1).max(5000)])))
    .safeParse(Object.fromEntries(whatsappTemplateKeys.map((key) => [key, input.get(`whatsapp.${key}`) ?? ""])));

  if (!parsed.success) {
    return invalidResult("Please complete each WhatsApp message template.", parsed.error);
  }

  try {
    await serverApiFetch("/settings", {
      body: JSON.stringify({ whatsapp: { templates: parsed.data } }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });
  } catch (error) {
    return errorResult(error, "Could not save WhatsApp templates.");
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/reports");

  return { ok: true, message: "WhatsApp templates saved.", errors: {} };
}

export async function saveShift(input: FormData): Promise<SettingsActionResult> {
  const parsed = shiftSchema.safeParse({
    ends_at: input.get("ends_at") || "",
    grace_minutes: input.get("grace_minutes") || "0",
    id: input.get("id") || "0",
    is_active: input.get("is_active") === "on" || input.get("is_active") === "true",
    name: input.get("name") || "",
    off_day_bonus_amount: input.get("off_day_bonus_amount") || "0",
    off_day_bonus_enabled: input.get("off_day_bonus_enabled") === "on" || input.get("off_day_bonus_enabled") === "true",
    off_days: input.getAll("off_days"),
    starts_at: input.get("starts_at") || "",
  });

  if (!parsed.success) {
    return invalidResult("Please fix the highlighted shift fields.", parsed.error);
  }

  const id = parsed.data.id;
  const payload = {
    ends_at: parsed.data.ends_at,
    grace_minutes: parsed.data.grace_minutes,
    is_active: parsed.data.is_active,
    name: parsed.data.name,
    off_day_bonus_amount: parsed.data.off_day_bonus_amount,
    off_day_bonus_enabled: parsed.data.off_day_bonus_enabled,
    off_days: [...new Set(parsed.data.off_days)].sort((a, b) => a - b),
    starts_at: parsed.data.starts_at,
  };

  try {
    await serverApiFetch(id > 0 ? `/attendance/shifts/${id}` : "/attendance/shifts", {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: id > 0 ? "PUT" : "POST",
    });
  } catch (error) {
    return errorResult(error, "Could not save shift.");
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/academy/staff");
  revalidatePath("/dashboard/attendance");

  return { ok: true, message: id > 0 ? "Shift saved." : "Shift created.", errors: {} };
}

export async function saveShiftOffRotation(
  prevStateOrInput: SettingsActionResult | FormData,
  formDataInput?: FormData,
): Promise<SettingsActionResult> {
  const input = formDataInput instanceof FormData ? formDataInput : (prevStateOrInput as FormData);
  const shiftId = z.coerce.number().int().positive("Shift is required.").safeParse(input.get("shift_id"));
  const employeeOrder = input
    .getAll("employee_order")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  const parsed = z
    .object({
      is_active: z.boolean(),
      off_weekday: z.coerce.number().int().min(0).max(6),
      rotation_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid start date."),
    })
    .safeParse({
      is_active: input.get("is_active") === "on" || input.get("is_active") === "true",
      off_weekday: input.get("off_weekday") || "5",
      rotation_start_date: input.get("rotation_start_date") || "",
    });

  if (!shiftId.success) {
    return { ok: false, message: "Shift is required.", errors: { shift_id: ["Shift is required."] } };
  }

  if (!parsed.success) {
    return invalidResult("Please fix the rotation fields.", parsed.error);
  }

  if (employeeOrder.length === 0) {
    return {
      ok: false,
      message: "Select at least one employee for the rotation order.",
      errors: { employee_order: ["Select at least one employee."] },
    };
  }

  try {
    await serverApiFetch(`/attendance/shifts/${shiftId.data}/off-rotation`, {
      body: JSON.stringify({
        employee_order: employeeOrder,
        is_active: parsed.data.is_active,
        off_weekday: parsed.data.off_weekday,
        rotation_start_date: parsed.data.rotation_start_date,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    });
  } catch (error) {
    return errorResult(error, "Could not save off-day rotation.");
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/academy/staff");
  revalidatePath("/dashboard/attendance");

  return { ok: true, message: "Off-day rotation saved.", errors: {} };
}

export async function deactivateShift(input: FormData): Promise<SettingsActionResult> {
  const id = z.coerce.number().int().positive("Shift is required.").safeParse(input.get("id"));

  if (!id.success) {
    return { ok: false, message: "Shift is required.", errors: { id: ["Shift is required."] } };
  }

  try {
    await serverApiFetch(`/attendance/shifts/${id.data}`, {
      method: "DELETE",
    });
  } catch (error) {
    return errorResult(error, "Could not deactivate shift.");
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/academy/staff");
  revalidatePath("/dashboard/attendance");

  return { ok: true, message: "Shift deactivated.", errors: {} };
}

export async function updateViolationRule(input: FormData): Promise<SettingsActionResult> {
  const parsed = violationRuleUpdateSchema.safeParse({
    auto_apply_if_unreviewed: input.get("auto_apply_if_unreviewed") === "on",
    deduction_days: input.get("deduction_days") || "0",
    description: nullableString(input.get("description")),
    id: input.get("id"),
    is_active: input.get("is_active") === "on",
    name: input.get("name") || "",
    requires_admin_approval: input.get("requires_admin_approval") === "on",
    threshold_minutes: nullableNumber(input.get("threshold_minutes")),
    warning_count_before_deduction: input.get("warning_count_before_deduction") || "0",
  });

  if (!parsed.success) {
    return invalidResult("Please fix the highlighted rule fields.", parsed.error);
  }

  const payload = {
    auto_apply_if_unreviewed: parsed.data.auto_apply_if_unreviewed,
    deduction_days: String(parsed.data.deduction_days),
    description: parsed.data.description,
    is_active: parsed.data.is_active,
    name: parsed.data.name,
    requires_admin_approval: parsed.data.requires_admin_approval,
    threshold_minutes: parsed.data.threshold_minutes,
    warning_count_before_deduction: parsed.data.warning_count_before_deduction,
  };

  try {
    await serverApiFetch(`/attendance/violation-rules/${parsed.data.id}`, {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    });
  } catch (error) {
    return errorResult(error, "Could not save attendance rule.");
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/payroll");

  return { ok: true, message: "Attendance rule saved.", errors: {} };
}

export async function createViolationRule(input: FormData): Promise<SettingsActionResult> {
  const parsed = violationRuleCreateSchema.safeParse({
    auto_apply_if_unreviewed: input.get("auto_apply_if_unreviewed") === "on",
    deduction_days: input.get("deduction_days") || "0",
    description: nullableString(input.get("description")),
    is_active: input.get("is_active") === "on",
    name: input.get("name") || "",
    requires_admin_approval: input.get("requires_admin_approval") === "on",
    threshold_minutes: nullableNumber(input.get("threshold_minutes")),
    warning_count_before_deduction: input.get("warning_count_before_deduction") || "0",
  });

  if (!parsed.success) {
    return invalidResult("Please fix the highlighted rule fields.", parsed.error);
  }

  const payload = {
    auto_apply_if_unreviewed: parsed.data.auto_apply_if_unreviewed,
    deduction_days: String(parsed.data.deduction_days),
    description: parsed.data.description,
    is_active: parsed.data.is_active,
    name: parsed.data.name,
    requires_admin_approval: parsed.data.requires_admin_approval,
    threshold_minutes: parsed.data.threshold_minutes,
    warning_count_before_deduction: parsed.data.warning_count_before_deduction,
  };

  try {
    await serverApiFetch("/attendance/violation-rules", {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    return errorResult(error, "Could not create attendance rule.");
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/payroll");

  return { ok: true, message: "Attendance rule created.", errors: {} };
}

function nullableNumber(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") {
    return null;
  }

  return Number(value);
}

function nullableString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}

function invalidResult(message: string, error: z.ZodError): SettingsActionResult {
  return {
    ok: false,
    message,
    errors: error.flatten().fieldErrors,
  };
}

function errorResult(error: unknown, fallback: string): SettingsActionResult {
  return {
    ok: false,
    message: error instanceof Error ? error.message : fallback,
    errors: {},
  };
}
