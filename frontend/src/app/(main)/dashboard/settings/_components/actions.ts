"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export async function updateSettings(input: FormData): Promise<void> {
  const payload = {
    attendance: {
      default_grace_minutes: Number(input.get("attendance.default_grace_minutes") || 0),
      gym_latitude: nullableNumber(input.get("attendance.gym_latitude")),
      gym_longitude: nullableNumber(input.get("attendance.gym_longitude")),
      gym_radius_meters: Number(input.get("attendance.gym_radius_meters") || 150),
    },
    currency: String(input.get("currency") || "EGP").toUpperCase(),
    gym: {
      colors: {
        primary: String(input.get("gym.colors.primary") || "#000000"),
        secondary: String(input.get("gym.colors.secondary") || "#ffffff"),
      },
      name: String(input.get("gym.name") || "Power Gym"),
    },
    reminder_days: Number(input.get("reminder_days") || 7),
    receipt_template: String(input.get("receipt_template") || "default"),
    vat_rate: Number(input.get("vat_rate") || 0),
  };

  await serverApiFetch("/settings", {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/infrastructure");
}

export async function saveShift(input: FormData): Promise<void> {
  const id = Number(input.get("id"));
  const payload = {
    ends_at: String(input.get("ends_at") || ""),
    grace_minutes: Number(input.get("grace_minutes") || 0),
    is_active: input.get("is_active") === "on" || input.get("is_active") === "true",
    name: String(input.get("name") || ""),
    starts_at: String(input.get("starts_at") || ""),
  };

  await serverApiFetch(id > 0 ? `/attendance/shifts/${id}` : "/attendance/shifts", {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: id > 0 ? "PUT" : "POST",
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/attendance");
}

export async function deactivateShift(input: FormData): Promise<void> {
  await serverApiFetch(`/attendance/shifts/${Number(input.get("id"))}`, {
    method: "DELETE",
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/attendance");
}

export async function updateViolationRule(input: FormData): Promise<void> {
  const payload = {
    auto_apply_if_unreviewed: input.get("auto_apply_if_unreviewed") === "on",
    deduction_days: String(input.get("deduction_days") || "0"),
    description: nullableString(input.get("description")),
    is_active: input.get("is_active") === "on",
    name: String(input.get("name") || ""),
    requires_admin_approval: input.get("requires_admin_approval") === "on",
    threshold_minutes: nullableNumber(input.get("threshold_minutes")),
  };

  await serverApiFetch(`/attendance/violation-rules/${Number(input.get("id"))}`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/payroll");
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
