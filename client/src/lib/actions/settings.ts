"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import type { AppLocale } from "@/i18n/routing";
import { getAuthToken } from "@/lib/session";
import type { AppSettings } from "@/lib/api/dashboard";

export type AttendanceSettingsData = {
  gym_latitude?: string | null;
  gym_longitude?: string | null;
  gym_radius_meters?: string | null;
  default_grace_minutes?: string | null;
};

export type ChangePasswordData = {
  current_password: string;
  password: string;
  password_confirmation: string;
};

async function settingsFetch(path: string, options: RequestInit = {}) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const details =
      (payload.error as { details?: Record<string, string[]> } | undefined)
        ?.details ?? undefined;
    const errorMessage =
      ((payload.error as { message?: string })?.message) ??
      (payload.message as string) ??
      response.statusText;

    if (details && Object.keys(details).length > 0) {
      throw new Error(JSON.stringify({ message: errorMessage, details }));
    }

    throw new Error(errorMessage);
  }

  return payload;
}

export async function updateAttendanceSettings(
  data: AttendanceSettingsData,
  locale: AppLocale
): Promise<AppSettings> {
  const payload = await settingsFetch("/settings", {
    method: "PUT",
    body: JSON.stringify({
      attendance: {
        gym_latitude: emptyToNull(data.gym_latitude),
        gym_longitude: emptyToNull(data.gym_longitude),
        gym_radius_meters: data.gym_radius_meters,
        default_grace_minutes: data.default_grace_minutes,
      },
    }),
  });

  revalidateSettings(locale);
  revalidatePath(`/${locale}/attendance`);
  revalidateTag("attendance", "max");

  return payload.data as AppSettings;
}

export async function changeOwnPassword(
  data: ChangePasswordData,
  locale: AppLocale
): Promise<void> {
  await settingsFetch("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(data),
  });

  revalidateSettings(locale);
}

function revalidateSettings(locale: AppLocale) {
  revalidatePath(`/${locale}/settings`);
  revalidateTag("settings", "max");
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
