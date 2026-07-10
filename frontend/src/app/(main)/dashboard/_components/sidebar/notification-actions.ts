"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

export async function markSidebarNotificationRead(id: string): Promise<void> {
  const notificationId = z.uuid().safeParse(id);

  if (!notificationId.success) {
    throw new Error("Invalid notification.");
  }

  await serverApiFetch(`/notifications/${encodeURIComponent(notificationId.data)}/read`, {
    method: "PATCH",
  });

  revalidateNotificationViews();
}

export async function markAllSidebarNotificationsRead(): Promise<void> {
  await serverApiFetch("/notifications/read-all", {
    method: "PATCH",
  });

  revalidateNotificationViews();
}

function revalidateNotificationViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/mail");
}
