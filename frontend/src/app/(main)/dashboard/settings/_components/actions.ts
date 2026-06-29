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

function nullableNumber(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") {
    return null;
  }

  return Number(value);
}
