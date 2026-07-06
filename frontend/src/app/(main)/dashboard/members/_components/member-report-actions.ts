"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

const endpoints = {
  booking: "bookings",
  document: "documents",
  nutrition: "nutrition-plans",
  progress: "progress",
  workout: "workout-plans",
} as const;

export type MemberReportKind = keyof typeof endpoints;

export type MemberReportFormState = {
  errors: Partial<Record<string, string[]>>;
  message?: string;
  ok: boolean;
  values: Record<string, string>;
};

const optionalTextInput = z.preprocess((value) => {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}, z.string().nullable());

const optionalNumberInput = z.preprocess((value) => {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}, z.coerce.number().nullable());

const progressSchema = z.object({
  body_fat_percent: optionalNumberInput,
  chest_cm: optionalNumberInput,
  hips_cm: optionalNumberInput,
  notes: optionalTextInput,
  recorded_on: z.string().date("Recorded date is required."),
  thighs_cm: optionalNumberInput,
  waist_cm: optionalNumberInput,
  weight_kg: optionalNumberInput,
  arms_cm: optionalNumberInput,
});

const workoutSchema = z.object({
  coach_id: z.preprocess(
    (value) => (String(value ?? "").trim() === "" ? null : value),
    z.coerce.number().int().positive().nullable(),
  ),
  ends_on: z.preprocess((value) => (String(value ?? "").trim() === "" ? null : value), z.string().date().nullable()),
  notes: optionalTextInput,
  sessions: optionalTextInput,
  starts_on: z.preprocess((value) => (String(value ?? "").trim() === "" ? null : value), z.string().date().nullable()),
  title: z.string().trim().min(1, "Title is required."),
});

const nutritionSchema = z.object({
  carbs_grams: optionalNumberInput,
  coach_id: z.preprocess(
    (value) => (String(value ?? "").trim() === "" ? null : value),
    z.coerce.number().int().positive().nullable(),
  ),
  daily_calories: optionalNumberInput,
  fat_grams: optionalNumberInput,
  notes: optionalTextInput,
  protein_grams: optionalNumberInput,
  supplements: optionalTextInput,
  title: z.string().trim().min(1, "Title is required."),
});

const bookingSchema = z.object({
  coach_id: z.preprocess(
    (value) => (String(value ?? "").trim() === "" ? null : value),
    z.coerce.number().int().positive().nullable(),
  ),
  ends_at_date: z.preprocess(
    (value) => (String(value ?? "").trim() === "" ? null : value),
    z.string().date().nullable(),
  ),
  ends_at_time: z.preprocess(
    (value) => (String(value ?? "").trim() === "" ? null : value),
    z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
  ),
  notes: optionalTextInput,
  starts_at_date: z.string().date("Start date is required."),
  starts_at_time: z.string().regex(/^\d{2}:\d{2}$/, "Start time is required."),
  title: z.string().trim().min(1, "Title is required."),
  type: z.string().trim().min(1).default("session"),
});

const documentSchema = z.object({
  document: z.instanceof(File, { message: "Select a document file." }),
  expires_on: z.preprocess((value) => (String(value ?? "").trim() === "" ? null : value), z.string().date().nullable()),
  notes: optionalTextInput,
  title: z.string().trim().min(1, "Title is required."),
  type: z.string().trim().min(1, "Type is required."),
});

export async function createMemberReportItem(
  memberId: number,
  _state: MemberReportFormState,
  input: FormData,
): Promise<MemberReportFormState> {
  const kind = String(input.get("kind") || "") as MemberReportKind;
  const values = getFormValues(input);

  const parsed = validateReportInput(kind, input);

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    if (kind === "document") {
      const documentInput = new FormData();
      for (const [key, value] of input.entries()) {
        if (key !== "kind") {
          documentInput.append(key, value);
        }
      }

      await serverApiFetch(`/members/${memberId}/${endpoints[kind]}`, {
        body: documentInput,
        method: "POST",
      });
    } else {
      await serverApiFetch(`/members/${memberId}/${endpoints[kind]}`, {
        body: JSON.stringify(buildPayload(kind, parsed.data)),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save report item.",
      errors: {},
      values,
    };
  }

  revalidatePath("/dashboard/members");

  return {
    ok: true,
    message: "Report item saved.",
    errors: {},
    values: {},
  };
}

function validateReportInput(kind: MemberReportKind, input: FormData) {
  const payload = getPayload(input);

  if (kind === "progress") {
    return progressSchema.safeParse(payload);
  }

  if (kind === "workout") {
    return workoutSchema.safeParse(payload);
  }

  if (kind === "nutrition") {
    return nutritionSchema.safeParse(payload);
  }

  if (kind === "booking") {
    return bookingSchema.safeParse(payload);
  }

  if (kind === "document") {
    return documentSchema.safeParse(payload);
  }

  return z.object({}).safeParse(payload);
}

function buildPayload(kind: MemberReportKind, input: Record<string, unknown>) {
  const payload = { ...input };

  if (kind === "booking") {
    combineDateTime(payload, "starts_at");
    combineDateTime(payload, "ends_at");
  }

  if (kind === "workout" && typeof payload.sessions === "string") {
    payload.sessions = payload.sessions
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((title) => ({ title }));
  }

  return payload;
}

function getPayload(input: FormData) {
  return Object.fromEntries(
    Array.from(input.entries())
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
      .filter(([key, value]) => key !== "kind" && value !== "" && value !== null),
  ) as Record<string, unknown>;
}

function getFormValues(input: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(input.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
}

function combineDateTime(payload: Record<string, unknown>, key: string) {
  const date = payload[`${key}_date`];
  const time = payload[`${key}_time`];

  delete payload[`${key}_date`];
  delete payload[`${key}_time`];

  if (typeof date === "string" && date && typeof time === "string" && time) {
    payload[key] = `${date}T${time}:00`;
  }
}
