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
  attendance_gym_latitude: z.coerce.number().min(-90).max(90).nullable(),
  attendance_gym_longitude: z.coerce.number().min(-180).max(180).nullable(),
  attendance_gym_radius_meters: z.coerce.number().int().min(1, "GPS radius must be at least 1 meter."),
  payroll_default_pay_day: z.coerce
    .number()
    .int()
    .min(1, "Pay day must be between 1 and 31.")
    .max(31, "Pay day must be between 1 and 31."),
  payroll_schedule_mode: z.enum(["fixed", "per_employee"]),
  reminder_days: z
    .array(z.coerce.number().int().min(0, "Reminder days cannot be negative."))
    .min(1, "Add at least one reminder day."),
  shifts_require_cash_count: z.boolean(),
  shifts_handover_auto_accept: z.boolean(),
  shifts_handover_auto_accept_on_match_only: z.boolean(),
  shifts_require_handover_to_open: z.boolean(),
});

const shiftSchema = z.object({
  id: z.coerce.number().int().min(0),
  is_active: z.boolean(),
  name: z.string().trim().min(2, "Shift name must be at least 2 characters.").max(120, "Shift name is too long."),
});

function parseReminderDays(input: FormDataEntryValue | null) {
  return String(input ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function updateSettings(input: FormData): Promise<SettingsActionResult> {
  const parsed = settingsSchema.safeParse({
    attendance_gym_latitude: nullableNumber(input.get("attendance.gym_latitude")),
    attendance_gym_longitude: nullableNumber(input.get("attendance.gym_longitude")),
    attendance_gym_radius_meters: input.get("attendance.gym_radius_meters") || "150",
    payroll_default_pay_day: input.get("payroll.default_pay_day") || "30",
    payroll_schedule_mode: input.get("payroll.schedule_mode") || "fixed",
    reminder_days: parseReminderDays(input.get("reminder_days")),
    shifts_require_cash_count:
      input.get("shifts.require_cash_count") === "on" || input.get("shifts.require_cash_count") === "true",
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
      gym_latitude: parsed.data.attendance_gym_latitude,
      gym_longitude: parsed.data.attendance_gym_longitude,
      gym_radius_meters: parsed.data.attendance_gym_radius_meters,
    },
    payroll: {
      default_pay_day: parsed.data.payroll_default_pay_day,
      schedule_mode: parsed.data.payroll_schedule_mode,
    },
    shifts: {
      require_cash_count: parsed.data.shifts_require_cash_count,
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

/**
 * Which member messages go out on their own, with no staff clicking send.
 *
 * Kept separate from saveWhatsAppTemplates so editing wording can never switch
 * automatic sending on as a side effect.
 */
export async function saveWhatsAppAutomation(input: FormData): Promise<SettingsActionResult> {
  const isChecked = (field: string) => {
    const value = input.get(field);

    return value === "on" || value === "true";
  };

  try {
    await serverApiFetch("/settings", {
      body: JSON.stringify({
        whatsapp: {
          auto_send: isChecked("whatsapp.auto_send"),
          // Every key is sent, not just the ticked ones: an unchecked box submits
          // nothing, so omitting them would leave a previously enabled event on.
          auto_events: Object.fromEntries(
            whatsappTemplateKeys.map((key) => [key, isChecked(`whatsapp.auto_events.${key}`)]),
          ),
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });
  } catch (error) {
    return errorResult(error, "Could not save WhatsApp automation settings.");
  }

  revalidatePath("/dashboard/settings");

  return { ok: true, message: "WhatsApp automation saved.", errors: {} };
}

export async function saveShift(input: FormData): Promise<SettingsActionResult> {
  const parsed = shiftSchema.safeParse({
    id: input.get("id") || "0",
    is_active: input.get("is_active") === "on" || input.get("is_active") === "true",
    name: input.get("name") || "",
  });

  if (!parsed.success) {
    return invalidResult("Please fix the highlighted shift fields.", parsed.error);
  }

  const id = parsed.data.id;
  const payload = {
    is_active: parsed.data.is_active,
    name: parsed.data.name,
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
