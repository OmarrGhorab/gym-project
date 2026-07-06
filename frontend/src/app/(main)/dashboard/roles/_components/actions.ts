"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

export type RoleActionResult = {
  ok: boolean;
  message: string;
  errors?: Partial<Record<string, string[]>>;
  values?: Record<string, string>;
};

const roleSchema = z.object({
  id: z.coerce.number().int().positive("Role is required.").optional(),
  name: z.string().trim().min(2, "Role name must be at least 2 characters.").max(80, "Role name is too long."),
  permissions: z.array(z.string().trim().min(1)).min(1, "Select at least one permission."),
});

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
  const values = {
    id: String(input.get("id") || ""),
    name: String(input.get("name") || ""),
  };
  const parsed = roleSchema.safeParse({
    id: input.has("id") ? input.get("id") : undefined,
    name: values.name,
    permissions,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted role fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    await serverApiFetch(path, {
      body: JSON.stringify({
        name: parsed.data.name,
        permissions: parsed.data.permissions,
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
    return { ok: false, message: getActionErrorMessage(error), errors: {}, values };
  }
}

function getActionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Action failed. Please try again.";
}
