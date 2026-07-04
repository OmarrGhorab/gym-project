"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

const endpoints = {
  booking: "bookings",
  document: "documents",
  nutrition: "nutrition-plans",
  progress: "progress",
  workout: "workout-plans",
} as const;

export type MemberReportKind = keyof typeof endpoints;

export async function createMemberReportItem(memberId: number, kind: MemberReportKind, input: FormData): Promise<void> {
  const payload = buildPayload(kind, input);

  await serverApiFetch(`/members/${memberId}/${endpoints[kind]}`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  revalidatePath("/dashboard/members");
}

function buildPayload(kind: MemberReportKind, input: FormData) {
  const payload = Object.fromEntries(
    Array.from(input.entries())
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
      .filter(([, value]) => value !== "" && value !== null),
  ) as Record<string, unknown>;

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

function combineDateTime(payload: Record<string, unknown>, key: string) {
  const date = payload[`${key}_date`];
  const time = payload[`${key}_time`];

  delete payload[`${key}_date`];
  delete payload[`${key}_time`];

  if (typeof date === "string" && date && typeof time === "string" && time) {
    payload[key] = `${date}T${time}:00`;
  }
}
