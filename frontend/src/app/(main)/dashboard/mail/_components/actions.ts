"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

export async function markNotificationRead(input: FormData): Promise<void> {
  const notificationId = z.uuid().safeParse(input.get("id"));

  if (!notificationId.success) {
    throw new Error("Invalid notification.");
  }

  await serverApiFetch(`/notifications/${encodeURIComponent(notificationId.data)}/read`, {
    method: "PATCH",
  });

  revalidatePath("/dashboard/mail");
}
