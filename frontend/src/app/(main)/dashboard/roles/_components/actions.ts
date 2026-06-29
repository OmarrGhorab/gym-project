"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export async function createRole(input: FormData): Promise<void> {
  await mutateRole("/roles", "POST", input);
}

export async function updateRole(input: FormData): Promise<void> {
  await mutateRole(`/roles/${Number(input.get("id"))}`, "PUT", input);
}

export async function deleteRole(input: FormData): Promise<void> {
  await serverApiFetch(`/roles/${Number(input.get("id"))}`, {
    method: "DELETE",
  });

  revalidatePath("/dashboard/roles");
  revalidatePath("/dashboard/users");
}

async function mutateRole(path: string, method: "POST" | "PUT", input: FormData) {
  const permissions = input.getAll("permissions").map(String).filter(Boolean);

  await serverApiFetch(path, {
    body: JSON.stringify({
      name: String(input.get("name") || ""),
      permissions,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method,
  });

  revalidatePath("/dashboard/roles");
  revalidatePath("/dashboard/users");
}
