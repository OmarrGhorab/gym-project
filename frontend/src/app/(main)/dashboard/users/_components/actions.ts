"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { ServerApiError, serverApiFetch } from "@/lib/api/server";

export type UserRoleActionResult = {
  ok: boolean;
  message: string;
  errors?: Partial<Record<string, string[]>>;
};

export type CreateUserActionResult = UserRoleActionResult;

const createUserSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address.").max(255),
    employee_id: z.preprocess(
      (value) => (value === "" || value === "none" || value === null ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
    name: z.string().trim().min(1, "Name is required.").max(255),
    password: z.string().min(8, "Password must be at least 8 characters."),
    password_confirmation: z.string().min(1, "Confirm the password."),
    roles: z.array(z.string().trim().min(1)).min(1, "Select at least one role.").max(20),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: "Passwords do not match.",
    path: ["password_confirmation"],
  });

const syncUserRolesSchema = z.object({
  roles: z.array(z.string().trim().min(1)).max(20, "Too many roles selected."),
  user_id: z.coerce.number().int().positive("User is required."),
});

export async function createUserAccount(input: FormData): Promise<CreateUserActionResult> {
  const parsed = createUserSchema.safeParse({
    email: input.get("email"),
    employee_id: input.get("employee_id"),
    name: input.get("name"),
    password: input.get("password"),
    password_confirmation: input.get("password_confirmation"),
    roles: input.getAll("roles").map(String).filter(Boolean),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted account fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await serverApiFetch("/users", {
      body: JSON.stringify(parsed.data),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create the account.",
      errors: error instanceof ServerApiError ? normalizeFieldErrors(error.details) : {},
    };
  }

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/roles");
  revalidatePath("/dashboard/academy/staff");
  revalidatePath("/dashboard", "layout");

  return {
    ok: true,
    message: "Account created.",
    errors: {},
  };
}

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

function normalizeFieldErrors(details: ServerApiError["details"]): Partial<Record<string, string[]>> {
  return Object.fromEntries(
    Object.entries(details ?? {}).map(([field, messages]) => {
      if (Array.isArray(messages)) {
        return [field, messages];
      }

      return [field, messages ? [messages] : []];
    }),
  );
}
