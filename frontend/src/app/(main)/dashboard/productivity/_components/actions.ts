"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export type CreateOperationsCalendarEventResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function createOperationsCalendarEvent(input: FormData): Promise<CreateOperationsCalendarEventResult> {
  const payload = {
    date: String(input.get("date") ?? ""),
    starts_at: null,
    ends_at: null,
    all_day: true,
    title: String(input.get("title") ?? ""),
    type: String(input.get("type") ?? "manual"),
    status: "scheduled",
    notes: String(input.get("notes") ?? ""),
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
