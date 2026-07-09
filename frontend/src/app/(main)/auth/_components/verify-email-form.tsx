"use client";

import { useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getErrorCode, getFieldErrors, getFriendlyError, resendVerificationOtp, verifyEmailOtp } from "@/lib/auth";
import { createVerifyEmailOtpSchema, validateWithSchema } from "@/lib/auth-validation";
import { firstAccessibleDashboardPath } from "@/lib/authorization";

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tCommon = useTranslations("Auth.common");
  const tRegister = useTranslations("Auth.register");
  const tVerify = useTranslations("Auth.verifyEmail");

  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
      if (getErrorCode(error) === "invalid_otp") {
        setFieldErrors({ otp: tVerify("enterValidCode") });
      } else {
        toast.error(tRegister("verificationFailed"), { description: getFriendlyError(error) });
        setFieldErrors(getFieldErrors(error) ?? {});
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Field className="gap-1.5" data-invalid={Boolean(fieldErrors.email)}>
          <FieldLabel htmlFor="verify-email">{tCommon("emailAddress")}</FieldLabel>
          <Input
            id="verify-email"
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

        <Field className="gap-1.5" data-invalid={Boolean(fieldErrors.otp)}>
          <FieldLabel htmlFor="verify-otp">{tRegister("verificationCode")}</FieldLabel>
          <Input
            id="verify-otp"
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
