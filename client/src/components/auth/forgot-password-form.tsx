"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import {
  forgotPassword,
  getFieldErrors,
  getFriendlyError,
  verifyOtp,
} from "@/lib/auth";
import {
  createForgotPasswordSchema,
  createVerifyOtpSchema,
  validateWithSchema,
} from "@/lib/auth-validation";
import { AuthHeader } from "./auth-header";

export function ForgotPasswordForm() {
  const t = useTranslations("ForgotPassword");
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFieldErrors({});

    const validationErrors = validateWithSchema(
      createForgotPasswordSchema({ invalidEmail: t("invalidEmail") }),
      { email }
    );

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      const result = await forgotPassword({ email });
      toast.success(t("successTitle"), { description: result.message });
      setStep("otp");
    } catch (err) {
      toast.error(t("errorTitle"), { description: getFriendlyError(err) });
      setFieldErrors(getFieldErrors(err) ?? {});
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
        invalidEmail: t("invalidEmail"),
        invalidOtp: t("invalidOtp"),
      }),
      { email, otp }
    );

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      const result = await verifyOtp({ email, otp });
      toast.success(t("verifiedTitle"), { description: result.message });
      router.push(
        `/${locale}/reset-password?email=${encodeURIComponent(
          email
        )}&token=${encodeURIComponent(result.data.reset_token)}`
      );
    } catch (err) {
      toast.error(t("errorTitle"), { description: getFriendlyError(err) });
      setFieldErrors(getFieldErrors(err) ?? {});
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <AuthHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={
          step === "email" ? t("description") : t("otpDescription")
        }
      />

      {step === "email" ? (
        <form onSubmit={handleEmailSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              className="h-12 rounded-xl bg-white/90 px-4 dark:bg-white/6"
            />
            {fieldErrors.email && (
              <p id="email-error" className="text-sm text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-[#ffe800] text-base font-semibold text-black shadow-[0_18px_35px_rgba(255,232,0,0.28)] hover:bg-[#f5de00]"
          >
            {loading ? t("submitLoading") : t("submit")}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="otp">{t("otpLabel")}</Label>
            <Input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              placeholder={t("otpPlaceholder")}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              aria-invalid={!!fieldErrors.otp}
              aria-describedby={fieldErrors.otp ? "otp-error" : undefined}
              className="h-12 rounded-xl bg-white/90 px-4 text-center text-2xl tracking-[0.5em] dark:bg-white/6"
            />
            {fieldErrors.otp && (
              <p id="otp-error" className="text-sm text-destructive">
                {fieldErrors.otp}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="h-12 w-full rounded-xl bg-[#ffe800] text-base font-semibold text-black shadow-[0_18px_35px_rgba(255,232,0,0.28)] hover:bg-[#f5de00]"
          >
            {loading ? t("verifyLoading") : t("verifySubmit")}
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => {
              setStep("email");
              setOtp("");
              setFieldErrors({});
            }}
            className="h-12 w-full"
          >
            {t("backToEmail")}
          </Button>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>{t("rememberPassword")}</span>
        <Link
          href="/login"
          className="font-semibold text-foreground transition-colors hover:text-[#d6b900]"
        >
          {t("signIn")}
        </Link>
      </div>
    </div>
  );
}
