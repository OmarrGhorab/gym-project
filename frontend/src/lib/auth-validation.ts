import { z } from "zod";

export type FieldErrors = Record<string, string>;

export function createLoginSchema(messages: { invalidEmail: string }) {
  return z.object({
    email: z.string().email(messages.invalidEmail).trim(),
    password: z.string().min(1, "Password is required."),
    remember: z.boolean().optional(),
  });
}

export function createRegisterSchema(messages: { invalidEmail: string; passwordMismatch: string }) {
  return z
    .object({
      name: z.string().min(1, "Name is required."),
      email: z.string().email(messages.invalidEmail).trim(),
      password: z.string().min(1, "Password is required."),
      password_confirmation: z.string().min(1, "Password confirmation is required."),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: messages.passwordMismatch,
      path: ["password_confirmation"],
    });
}

export function createForgotPasswordSchema(messages: { invalidEmail: string }) {
  return z.object({
    email: z.string().email(messages.invalidEmail).trim(),
  });
}

export function createVerifyOtpSchema(messages: { invalidEmail: string; invalidOtp: string }) {
  return z.object({
    email: z.string().email(messages.invalidEmail).trim(),
    otp: z
      .string()
      .length(6, messages.invalidOtp)
      .regex(/^\d{6}$/, messages.invalidOtp),
  });
}

export function createVerifyEmailOtpSchema(messages: { invalidEmail: string; invalidOtp: string }) {
  return createVerifyOtpSchema(messages);
}

export function createResetPasswordSchema(messages: { passwordMismatch: string }) {
  return z
    .object({
      password: z.string().min(1, "Password is required."),
      password_confirmation: z.string().min(1, "Password confirmation is required."),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: messages.passwordMismatch,
      path: ["password_confirmation"],
    });
}

export function validateWithSchema<T>(schema: z.ZodType<T>, payload: unknown): FieldErrors {
  const result = schema.safeParse(payload);

  if (!result.success) {
    return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message]));
  }

  return {};
}
