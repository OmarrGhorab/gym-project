"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

export type CreateOperationsCalendarEventResult =
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

const operationsCalendarEventSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
  notes: z.string().trim().max(1000, "Notes are too long.").optional(),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(120, "Title is too long."),
  type: z.enum(["manual", "attendance", "finance", "inventory"], {
    error: "Choose a valid event type.",
  }),
});

export async function createOperationsCalendarEvent(input: FormData): Promise<CreateOperationsCalendarEventResult> {
  const parsed = operationsCalendarEventSchema.safeParse({
    date: String(input.get("date") ?? ""),
    notes: String(input.get("notes") ?? ""),
    title: String(input.get("title") ?? ""),
    type: String(input.get("type") ?? "manual"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted event fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const payload = {
    date: parsed.data.date,
    starts_at: null,
    ends_at: null,
    all_day: true,
    title: parsed.data.title,
    type: parsed.data.type,
    status: "scheduled",
    notes: parsed.data.notes ?? "",
  };

  try {
    await serverApiFetch("/reports/operations-calendar-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create calendar event.",
    };
  }

  revalidatePath("/dashboard/productivity");

  return {
    ok: true,
    message: "Calendar event created.",
  };
}
