"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getFieldErrors, getFriendlyError, resetPassword } from "@/lib/auth";
import { createResetPasswordSchema, validateWithSchema } from "@/lib/auth-validation";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tCommon = useTranslations("Auth.common");
  const tReset = useTranslations("Auth.reset");
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFieldErrors({});

    const validationErrors = validateWithSchema(
      createResetPasswordSchema({ passwordMismatch: tCommon("passwordMismatch") }),
      {
        password,
        password_confirmation: passwordConfirmation,
      },
    );

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      const result = await resetPassword({
        email,
        token,
        password,
        password_confirmation: passwordConfirmation,
      });
      toast.success(tReset("passwordUpdated"), { description: result.message });
      router.push("/auth/v2/login");
    } catch (error) {
      toast.error(tReset("couldNotReset"), { description: getFriendlyError(error) });
      setFieldErrors(getFieldErrors(error) ?? {});
    } finally {
      setLoading(false);
    }
  }

  if (!email || !token) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">{tReset("missingLink")}</p>
        <Button className="w-full" render={<Link href="/auth/v2/forgot-password" />}>
          {tReset("requestNewCode")}
        </Button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="reset-email">{tCommon("emailAddress")}</FieldLabel>
          <Input id="reset-email" name="email" type="email" value={email} disabled />
        </Field>

        <Field className="gap-1.5" data-invalid={Boolean(fieldErrors.password)}>
          <FieldLabel htmlFor="reset-password">{tReset("newPassword")}</FieldLabel>
          <Input
            id="reset-password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
          />
          {fieldErrors.password && <FieldError>{fieldErrors.password}</FieldError>}
        </Field>

        <Field className="gap-1.5" data-invalid={Boolean(fieldErrors.password_confirmation)}>
          <FieldLabel htmlFor="reset-password-confirmation">{tReset("confirmNewPassword")}</FieldLabel>
          <Input
            id="reset-password-confirmation"
            name="password_confirmation"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            aria-invalid={Boolean(fieldErrors.password_confirmation)}
          />
          {fieldErrors.password_confirmation && <FieldError>{fieldErrors.password_confirmation}</FieldError>}
        </Field>
      </FieldGroup>
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? tReset("savingPassword") : tReset("resetPassword")}
      </Button>
    </form>
  );
}
