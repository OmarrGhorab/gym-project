"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  getFieldErrors,
  getFriendlyError,
  register as registerUser,
  resendVerificationOtp,
  verifyEmailOtp,
} from "@/lib/auth";
import { createRegisterSchema, createVerifyEmailOtpSchema, validateWithSchema } from "@/lib/auth-validation";
import { firstAccessibleDashboardPath } from "@/lib/authorization";

export function RegisterForm() {
  const router = useRouter();
  const tCommon = useTranslations("Auth.common");
  const tRegister = useTranslations("Auth.register");

  const [step, setStep] = useState<"details" | "otp">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleDetailsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFieldErrors({});

    const validationErrors = validateWithSchema(
      createRegisterSchema({
        invalidEmail: tCommon("invalidEmail"),
        passwordMismatch: tCommon("passwordMismatch"),
      }),
      {
        name,
        email,
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
      const result = await registerUser({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });
      toast.success(tRegister("codeSent"), { description: result.message });
      setStep("otp");
    } catch (error) {
      toast.error(tRegister("registrationFailed"), { description: getFriendlyError(error) });
      setFieldErrors(getFieldErrors(error) ?? {});
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFieldErrors({});

    const validationErrors = validateWithSchema(
      createVerifyEmailOtpSchema({
        invalidEmail: tCommon("invalidEmail"),
        invalidOtp: tCommon("invalidVerificationCode"),
      }),
      { email, otp },
    );

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      const result = await verifyEmailOtp({ email, otp });
      toast.success(tRegister("emailVerified"), { description: result.message });
      router.replace(firstAccessibleDashboardPath({ permissions: result.data.user.permissions ?? [] }));
    } catch (error) {
      toast.error(tRegister("verificationFailed"), { description: getFriendlyError(error) });
      setFieldErrors(getFieldErrors(error) ?? {});
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setLoading(true);

    try {
      const result = await resendVerificationOtp({ email });
      toast.success(tRegister("codeSent"), { description: result.message });
    } catch (error) {
      toast.error(tRegister("couldNotResend"), { description: getFriendlyError(error) });
    } finally {
      setLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <form noValidate onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
        <FieldGroup className="gap-4">
          <Field className="gap-1.5" data-invalid={Boolean(fieldErrors.otp)}>
            <FieldLabel htmlFor="register-otp">{tRegister("verificationCode")}</FieldLabel>
            <Input
              id="register-otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
              aria-invalid={Boolean(fieldErrors.otp)}
            />
            {fieldErrors.otp && <FieldError>{fieldErrors.otp}</FieldError>}
          </Field>
        </FieldGroup>
        <Button className="w-full" type="submit" disabled={loading || otp.length !== 6}>
          {loading ? tRegister("verifying") : tRegister("verifyEmail")}
        </Button>
        <Button className="w-full" type="button" variant="ghost" disabled={loading} onClick={handleResend}>
          {tRegister("resendCode")}
        </Button>
      </form>
    );
  }

  return (
    <form noValidate onSubmit={handleDetailsSubmit} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Field className="gap-1.5" data-invalid={Boolean(fieldErrors.name)}>
          <FieldLabel htmlFor="register-name">{tRegister("fullName")}</FieldLabel>
          <Input
            id="register-name"
            name="name"
            type="text"
            placeholder="Raven Admin"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name && <FieldError>{fieldErrors.name}</FieldError>}
        </Field>

        <Field className="gap-1.5" data-invalid={Boolean(fieldErrors.email)}>
          <FieldLabel htmlFor="register-email">{tCommon("emailAddress")}</FieldLabel>
          <Input
            id="register-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
        </Field>

        <Field className="gap-1.5" data-invalid={Boolean(fieldErrors.password)}>
          <FieldLabel htmlFor="register-password">{tCommon("password")}</FieldLabel>
          <Input
            id="register-password"
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
          <FieldLabel htmlFor="register-password-confirmation">{tRegister("confirmPassword")}</FieldLabel>
          <Input
            id="register-password-confirmation"
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
        {loading ? tRegister("creating") : tRegister("createAccount")}
      </Button>
    </form>
  );
}
