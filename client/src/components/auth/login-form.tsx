"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import {
  getErrorCode,
  getFieldErrors,
  getFriendlyError,
  login,
} from "@/lib/auth";
import { createLoginSchema, validateWithSchema } from "@/lib/auth-validation";
import { GoogleButton } from "./google-button";
import { AuthHeader } from "./auth-header";

export function LoginForm() {
  const t = useTranslations("Login");
  const locale = useLocale();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFieldErrors({});

    const validationErrors = validateWithSchema(
      createLoginSchema({ invalidEmail: t("invalidEmail") }),
      { email, password, remember }
    );

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      await login({ email, password, remember });
      router.push(`/${locale}`);
    } catch (err) {
      if (getErrorCode(err) === "email_not_verified") {
        router.push(
          `/${locale}/verify-email?email=${encodeURIComponent(email)}`
        );
        return;
      }

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
          <Label htmlFor="password">{t("passwordLabel")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
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

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Label
            htmlFor="remember"
            className="flex cursor-pointer items-center gap-2 text-muted-foreground"
          >
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(checked === true)}
            />
            <span>{t("rememberMe")}</span>
          </Label>
          <Link
            href="/forgot-password"
            className="font-medium text-slate-700 transition-colors hover:text-black dark:text-white/80 dark:hover:text-white"
          >
            {t("forgotPassword")}
          </Link>
        </div>

        <div className="space-y-3">
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-[#ffe800] text-base font-semibold text-black shadow-[0_18px_35px_rgba(255,232,0,0.28)] hover:bg-[#f5de00]"
          >
            {loading ? t("submitLoading") : t("submit")}
          </Button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/70" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#fffcf2] px-2 text-muted-foreground dark:bg-[#161616]">
                {t("orContinueWith")}
              </span>
            </div>
          </div>

          <GoogleButton label={t("googleButton")} />
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>{t("noAccount")}</span>
        <Link
          href="/register"
          className="font-semibold text-foreground transition-colors hover:text-[#d6b900]"
        >
          {t("createAccount")}
        </Link>
      </div>
    </div>
  );
}
