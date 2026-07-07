"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

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
  reminder_days: z.coerce.number().int().min(0, "Reminder days cannot be negative."),
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

export async function updateSettings(input: FormData): Promise<SettingsActionResult> {
  const parsed = settingsSchema.safeParse({
    attendance_default_grace_minutes: input.get("attendance.default_grace_minutes") || "0",
    attendance_gym_latitude: nullableNumber(input.get("attendance.gym_latitude")),
    attendance_gym_longitude: nullableNumber(input.get("attendance.gym_longitude")),
    attendance_gym_radius_meters: input.get("attendance.gym_radius_meters") || "150",
    reminder_days: input.get("reminder_days") || "7",
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

  return { ok: true, message: "Settings saved.", errors: {} };
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
  revalidatePath("/dashboard/attendance");

  return { ok: true, message: id > 0 ? "Shift saved." : "Shift created.", errors: {} };
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
