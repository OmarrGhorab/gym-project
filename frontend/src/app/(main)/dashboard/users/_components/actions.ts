"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

export type UserRoleActionResult = {
  ok: boolean;
  message: string;
  errors?: Partial<Record<string, string[]>>;
};

const syncUserRolesSchema = z.object({
  roles: z.array(z.string().trim().min(1)).max(20, "Too many roles selected."),
  user_id: z.coerce.number().int().positive("User is required."),
});

export async function syncUserRoles(input: FormData): Promise<UserRoleActionResult> {
  const parsed = syncUserRolesSchema.safeParse({
    roles: input.getAll("roles").map(String).filter(Boolean),
    user_id: input.get("user_id"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted user role fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await serverApiFetch(`/users/${parsed.data.user_id}/roles`, {
      body: JSON.stringify({ roles: parsed.data.roles }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update user roles.",
      errors: {},
    };
  }

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/roles");
  revalidatePath("/dashboard", "layout");

  return {
    ok: true,
    message: "User roles updated.",
    errors: {},
  };
}
