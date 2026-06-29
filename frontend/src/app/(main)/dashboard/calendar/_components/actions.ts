"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export type CalendarActionResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function createCalendarEvent(input: FormData): Promise<CalendarActionResult> {
  return mutateCalendarEvent("/reports/operations-calendar-events", "POST", input, "Calendar event created.");
}

export async function updateCalendarEvent(id: number, input: FormData): Promise<CalendarActionResult> {
  return mutateCalendarEvent(`/reports/operations-calendar-events/${id}`, "PUT", input, "Calendar event updated.");
}

export async function deleteCalendarEvent(id: number): Promise<CalendarActionResult> {
  try {
    await serverApiFetch(`/reports/operations-calendar-events/${id}`, {
      method: "DELETE",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not delete calendar event.",
    };
  }

  revalidateCalendar();

  return {
    ok: true,
    message: "Calendar event deleted.",
  };
}

async function mutateCalendarEvent(
  path: string,
  method: "POST" | "PUT",
  input: FormData,
  successMessage: string,
): Promise<CalendarActionResult> {
  const date = String(input.get("date") ?? "");
  const startsAt = buildDateTime(date, String(input.get("start_time") ?? ""));
  const endsAt = buildDateTime(date, String(input.get("end_time") ?? ""));
  const assignedEmployeeId = String(input.get("assigned_employee_id") ?? "");

  const payload = {
    date,
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: !startsAt,
    title: String(input.get("title") ?? ""),
    type: String(input.get("type") ?? "manual"),
    status: String(input.get("status") ?? "scheduled"),
    assigned_employee_id: assignedEmployeeId && assignedEmployeeId !== "none" ? Number(assignedEmployeeId) : null,
    location: String(input.get("location") ?? ""),
    notes: String(input.get("notes") ?? ""),
  };

  try {
    await serverApiFetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save calendar event.",
    };
  }

  revalidateCalendar();

  return {
    ok: true,
    message: successMessage,
  };
}

function buildDateTime(date: string, time: string) {
  if (!date || !time) {
    return null;
  }

  return `${date}T${time}:00`;
}

function revalidateCalendar() {
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/productivity");
}
