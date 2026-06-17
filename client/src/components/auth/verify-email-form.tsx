"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import {
  getErrorCode,
  getFieldErrors,
  getFriendlyError,
  resendVerificationOtp,
  verifyEmailOtp,
} from "@/lib/auth";
import {
  createVerifyEmailOtpSchema,
  validateWithSchema,
} from "@/lib/auth-validation";
import { AuthHeader } from "./auth-header";

export function VerifyEmailForm() {
  const t = useTranslations("VerifyEmail");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleResend() {
    setLoading(true);

    try {
      const result = await resendVerificationOtp({ email });
      toast.success(t("verificationSentTitle"), {
        description: result.message,
      });
    } catch (err) {
      toast.error(t("errorTitle"), { description: getFriendlyError(err) });
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
      const result = await verifyEmailOtp({ email, otp });
      toast.success(t("verifiedTitle"), { description: result.message });
      router.push(`/${locale}`);
    } catch (err) {
      const code = getErrorCode(err);
      if (code === "invalid_otp") {
        setFieldErrors({ otp: t("invalidOtp") });
      } else {
        toast.error(t("errorTitle"), { description: getFriendlyError(err) });
        setFieldErrors(getFieldErrors(err) ?? {});
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <AuthHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />

      <form onSubmit={handleSubmit} className="space-y-5">
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
          onClick={handleResend}
          className="h-12 w-full"
        >
          {t("resendCode")}
        </Button>
      </form>

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
