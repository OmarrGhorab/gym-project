"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export async function syncUserRoles(input: FormData): Promise<void> {
  const userId = Number(input.get("user_id"));
  const roles = input.getAll("roles").map(String).filter(Boolean);

  await serverApiFetch(`/users/${userId}/roles`, {
    body: JSON.stringify({ roles }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/roles");
  revalidatePath("/dashboard", "layout");
}
