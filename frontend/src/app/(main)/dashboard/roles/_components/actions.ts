"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export type RoleActionResult = {
  ok: boolean;
  message: string;
};

export async function createRole(input: FormData): Promise<RoleActionResult> {
  return mutateRole("/roles", "POST", input, "Role created successfully.");
}

export async function updateRole(input: FormData): Promise<RoleActionResult> {
  return mutateRole(`/roles/${Number(input.get("id"))}`, "PUT", input, "Role permissions updated successfully.");
}

export async function deleteRole(input: FormData): Promise<RoleActionResult> {
  try {
    await serverApiFetch(`/roles/${Number(input.get("id"))}`, {
      method: "DELETE",
    });

    revalidatePath("/dashboard/roles");
    revalidatePath("/dashboard/users");

    return { ok: true, message: "Role deleted successfully." };
  } catch (error) {
    return { ok: false, message: getActionErrorMessage(error) };
  }
}

async function mutateRole(
  path: string,
  method: "POST" | "PUT",
  input: FormData,
  successMessage: string,
): Promise<RoleActionResult> {
  const permissions = input.getAll("permissions").map(String).filter(Boolean);

  try {
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

    return { ok: true, message: successMessage };
  } catch (error) {
    return { ok: false, message: getActionErrorMessage(error) };
  }
}

function getActionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Action failed. Please try again.";
}
