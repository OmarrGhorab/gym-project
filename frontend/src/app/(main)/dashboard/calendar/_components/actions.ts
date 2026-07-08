"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

export type CalendarActionResult =
  | {
      ok: true;
      message: string;
      errors?: Partial<Record<string, string[]>>;
    }
  | {
      ok: false;
      message: string;
      errors?: Partial<Record<string, string[]>>;
    };

const calendarEventSchema = z
  .object({
    assigned_employee_ids: z.array(z.coerce.number().int().positive()).default([]),
    custom_type_label: z.string().trim().max(120, "Custom type is too long.").optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
    end_time: z.string().optional(),
    location: z.string().trim().max(120, "Location is too long.").optional(),
    notes: z.string().trim().max(1000, "Notes are too long.").optional(),
    start_time: z.string().optional(),
    status: z.enum(["scheduled", "done", "delayed", "cancelled"], {
      error: "Choose a valid status.",
    }),
    title: z.string().trim().min(2, "Title must be at least 2 characters.").max(120, "Title is too long."),
    type: z.enum(
      [
        "shift",
        "class",
        "pt_session",
        "training",
        "meeting",
        "sales",
        "renewal",
        "payroll",
        "attendance",
        "inventory",
        "maintenance",
        "finance",
        "cleaning",
        "manual",
      ],
      {
        error: "Choose a valid event type.",
      },
    ),
  })
  .refine((value) => value.type !== "manual" || Boolean(value.custom_type_label?.trim()), {
    message: "Enter a custom type label.",
    path: ["custom_type_label"],
  })
  .refine((value) => !value.end_time || !value.start_time || value.end_time >= value.start_time, {
    message: "End time cannot be before start time.",
    path: ["end_time"],
  });

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
  const assignedEmployeeIds = input
    .getAll("assigned_employee_ids")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  const parsed = calendarEventSchema.safeParse({
    assigned_employee_ids: assignedEmployeeIds,
    custom_type_label: String(input.get("custom_type_label") ?? ""),
    date,
    end_time: String(input.get("end_time") ?? ""),
    location: String(input.get("location") ?? ""),
    notes: String(input.get("notes") ?? ""),
    start_time: String(input.get("start_time") ?? ""),
    status: String(input.get("status") ?? "scheduled"),
    title: String(input.get("title") ?? ""),
    type: String(input.get("type") ?? "manual"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted calendar fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const startsAt = buildDateTime(parsed.data.date, parsed.data.start_time ?? "");
  const endsAt = buildDateTime(parsed.data.date, parsed.data.end_time ?? "");

  const payload = {
    date: parsed.data.date,
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: !startsAt,
    title: parsed.data.title,
    type: parsed.data.type,
    custom_type_label: parsed.data.type === "manual" ? (parsed.data.custom_type_label?.trim() ?? "") : null,
    status: parsed.data.status,
    assigned_employee_ids: parsed.data.assigned_employee_ids,
    location: parsed.data.location ?? "",
    notes: parsed.data.notes ?? "",
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
