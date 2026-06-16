"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import {
  getFieldErrors,
  getFriendlyError,
  resetPassword,
} from "@/lib/auth";
import {
  createResetPasswordSchema,
  validateWithSchema,
} from "@/lib/auth-validation";
import { AuthHeader } from "./auth-header";

export function ResetPasswordForm() {
  const t = useTranslations("ResetPassword");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const validationErrors = validateWithSchema(
      createResetPasswordSchema({
        passwordMismatch: t("passwordMismatch"),
      }),
      {
        password,
        password_confirmation: passwordConfirmation,
      }
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
      setSuccess(result.message);
      setTimeout(() => router.push(`/${locale}/login`), 2000);
    } catch (err) {
      setError(getFriendlyError(err));
      setFieldErrors(getFieldErrors(err) ?? {});
    } finally {
      setLoading(false);
    }
  }

  if (!token || !email) {
    return (
      <div className="space-y-8">
        <AuthHeader title={t("title")} description={t("invalidLink")} />
        <Button
          asChild
          className="h-12 w-full rounded-xl bg-[#ffe800] text-base font-semibold text-black shadow-[0_18px_35px_rgba(255,232,0,0.28)] hover:bg-[#f5de00]"
        >
          <Link href="/forgot-password">{t("requestNewLink")}</Link>
        </Button>
      </div>
    );
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
            value={email}
            disabled
            className="h-12 rounded-xl bg-white/90 px-4 opacity-70 dark:bg-white/6"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t("passwordLabel")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder={t("passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={
              fieldErrors.password ? "password-error" : undefined
            }
            className="h-12 rounded-xl bg-white/90 px-4 dark:bg-white/6"
          />
          {fieldErrors.password && (
            <p id="password-error" className="text-sm text-destructive">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password_confirmation">
            {t("passwordConfirmationLabel")}
          </Label>
          <Input
            id="password_confirmation"
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            required
            placeholder={t("passwordConfirmationPlaceholder")}
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            aria-invalid={!!fieldErrors.password_confirmation}
            aria-describedby={
              fieldErrors.password_confirmation
                ? "password-confirmation-error"
                : undefined
            }
            className="h-12 rounded-xl bg-white/90 px-4 dark:bg-white/6"
          />
          {fieldErrors.password_confirmation && (
            <p
              id="password-confirmation-error"
              className="text-sm text-destructive"
            >
              {fieldErrors.password_confirmation}
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
            {success}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-xl bg-[#ffe800] text-base font-semibold text-black shadow-[0_18px_35px_rgba(255,232,0,0.28)] hover:bg-[#f5de00]"
        >
          {loading ? t("submitLoading") : t("submit")}
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
