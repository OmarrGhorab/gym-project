"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { type AppLocale, getLocaleDirection } from "@/i18n/config";

export function LanguageToggle() {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Auth.common");
  const [language, setLanguage] = useState<AppLocale>(locale);

  useEffect(() => {
    applyLanguage(locale);
    setLanguage(locale);
  }, [locale]);

  async function toggleLanguage() {
    const nextLanguage = language === "en" ? "ar" : "en";
    applyLanguage(nextLanguage);
    setLanguage(nextLanguage);
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: nextLanguage }),
    });
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5 rounded-full px-2.5 text-muted-foreground hover:text-foreground"
      onClick={toggleLanguage}
      aria-label={t("switchToArabic")}
    >
      <Globe className="size-4" />
      {t("languageLabel")}
    </Button>
  );
}

function applyLanguage(language: AppLocale) {
  document.documentElement.lang = language;
  document.documentElement.dir = getLocaleDirection(language);
}
