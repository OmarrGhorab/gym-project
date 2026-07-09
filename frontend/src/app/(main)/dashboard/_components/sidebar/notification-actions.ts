"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export async function markSidebarNotificationRead(id: string): Promise<void> {
  await serverApiFetch(`/notifications/${id}/read`, {
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
