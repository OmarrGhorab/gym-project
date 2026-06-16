import { z } from "zod";

export type FieldErrors = Record<string, string>;

function getFieldErrors(result: z.ZodSafeParseResult<unknown>): FieldErrors {
  if (result.success) return {};

  return Object.fromEntries(
    result.error.issues.map((issue) => [
      issue.path.join("."),
      issue.message,
    ])
  );
}

export function createLoginSchema(messages: { invalidEmail: string }) {
  return z.object({
    email: z.email(messages.invalidEmail).trim(),
    password: z.string().min(1),
    remember: z.boolean().optional(),
  });
}

export function createRegisterSchema(messages: {
  invalidEmail: string;
  passwordMismatch: string;
}) {
  return z
    .object({
      name: z.string().min(1),
      email: z.email(messages.invalidEmail).trim(),
      password: z.string().min(1),
      password_confirmation: z.string().min(1),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: messages.passwordMismatch,
      path: ["password_confirmation"],
    });
}

export function createForgotPasswordSchema(messages: { invalidEmail: string }) {
  return z.object({
    email: z.email(messages.invalidEmail).trim(),
  });
}

export function createResetPasswordSchema(messages: {
  passwordMismatch: string;
}) {
  return z
    .object({
      password: z.string().min(1),
      password_confirmation: z.string().min(1),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: messages.passwordMismatch,
      path: ["password_confirmation"],
    });
}

export function validateWithSchema<T>(
  schema: z.ZodType<T>,
  payload: unknown
): FieldErrors {
  return getFieldErrors(schema.safeParse(payload));
}
