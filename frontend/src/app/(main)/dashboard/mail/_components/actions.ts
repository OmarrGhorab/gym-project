"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export async function markNotificationRead(input: FormData): Promise<void> {
  await serverApiFetch(`/notifications/${String(input.get("id"))}/read`, {
    method: "PATCH",
  });

  revalidatePath("/dashboard/mail");
}
