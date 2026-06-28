"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { forgotPassword, getFieldErrors, getFriendlyError, verifyOtp } from "@/lib/auth";
import { createForgotPasswordSchema, createVerifyOtpSchema, validateWithSchema } from "@/lib/auth-validation";

export function ForgotPasswordForm() {
  const router = useRouter();
  const tCommon = useTranslations("Auth.common");
  const tForgot = useTranslations("Auth.forgot");

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFieldErrors({});

    const validationErrors = validateWithSchema(createForgotPasswordSchema({ invalidEmail: tCommon("invalidEmail") }), {
      email,
    });

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      const result = await forgotPassword({ email });
      toast.success(tForgot("resetCodeSent"), { description: result.message });
      setStep("otp");
    } catch (error) {
      toast.error(tForgot("couldNotSend"), { description: getFriendlyError(error) });
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
      createVerifyOtpSchema({
        invalidEmail: tCommon("invalidEmail"),
        invalidOtp: tCommon("invalidResetCode"),
      }),
      { email, otp },
    );

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      const result = await verifyOtp({ email, otp });
      toast.success(tForgot("codeVerified"), { description: result.message });
      router.push(
        `/auth/v2/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(result.data.reset_token)}`,
      );
    } catch (error) {
      toast.error(tForgot("verificationFailed"), { description: getFriendlyError(error) });
      setFieldErrors(getFieldErrors(error) ?? {});
    } finally {
      setLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <form noValidate onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
        <FieldGroup className="gap-4">
          <Field className="gap-1.5" data-invalid={Boolean(fieldErrors.otp)}>
            <FieldLabel htmlFor="reset-otp">{tForgot("resetCode")}</FieldLabel>
            <Input
              id="reset-otp"
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
          {loading ? tForgot("verifying") : tForgot("verifyCode")}
        </Button>
        <Button
          className="w-full"
          type="button"
          variant="ghost"
          disabled={loading}
          onClick={() => {
            setStep("email");
            setOtp("");
            setFieldErrors({});
          }}
        >
          {tForgot("backToEmail")}
        </Button>
      </form>
    );
  }

  return (
    <form noValidate onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Field className="gap-1.5" data-invalid={Boolean(fieldErrors.email)}>
          <FieldLabel htmlFor="forgot-email">{tCommon("emailAddress")}</FieldLabel>
          <Input
            id="forgot-email"
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
      </FieldGroup>
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? tForgot("sendingCode") : tForgot("sendResetCode")}
      </Button>
    </form>
  );
}
