"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import {
  getFieldErrors,
  getFriendlyError,
  register as registerUser,
} from "@/lib/auth";
import { GoogleButton } from "./google-button";
import { AuthHeader } from "./auth-header";

export function RegisterForm() {
  const t = useTranslations("Register");
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      await registerUser({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });
      router.push("/");
    } catch (err) {
      setError(getFriendlyError(err));
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
          <Label htmlFor="name">{t("nameLabel")}</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!fieldErrors.name}
            className="h-12 rounded-xl bg-white/90 px-4 dark:bg-white/6"
          />
          {fieldErrors.name && (
            <p className="text-sm text-destructive">{fieldErrors.name}</p>
          )}
        </div>

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
            className="h-12 rounded-xl bg-white/90 px-4 dark:bg-white/6"
          />
          {fieldErrors.email && (
            <p className="text-sm text-destructive">{fieldErrors.email}</p>
          )}
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
            className="h-12 rounded-xl bg-white/90 px-4 dark:bg-white/6"
          />
          {fieldErrors.password && (
            <p className="text-sm text-destructive">{fieldErrors.password}</p>
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
            className="h-12 rounded-xl bg-white/90 px-4 dark:bg-white/6"
          />
          {fieldErrors.password_confirmation && (
            <p className="text-sm text-destructive">
              {fieldErrors.password_confirmation}
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

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
        <span>{t("hasAccount")}</span>
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
