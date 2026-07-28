"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppLocale } from "@/i18n/config";

import { LOCALE_SWITCH_END, LOCALE_SWITCH_START } from "./locale-switch-overlay";

const languageOptions: { label: string; value: AppLocale }[] = [
  { label: "English", value: "en" },
  { label: "العربية", value: "ar" },
];

export function LanguageSelector({ className, showIcon = true }: { className?: string; showIcon?: boolean }) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Dashboard.nav");
  const [pendingLocale, setPendingLocale] = useState<AppLocale | null>(null);

  async function updateLocale(nextLocale: AppLocale) {
    if (nextLocale === locale || pendingLocale) {
      return;
    }

    setPendingLocale(nextLocale);
    window.dispatchEvent(new CustomEvent<AppLocale>(LOCALE_SWITCH_START, { detail: nextLocale }));

    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });

      if (!response.ok) {
        throw new Error("Could not update language preference.");
      }

      router.refresh();
    } catch {
      window.dispatchEvent(new Event(LOCALE_SWITCH_END));
      setPendingLocale(null);
    }
  }

  return (
    <Select
      disabled={pendingLocale !== null}
      value={locale}
      onValueChange={(value) => updateLocale(value as AppLocale)}
    >
      <SelectTrigger size="sm" aria-label={t("selectLanguage")} className={className}>
        {showIcon ? <Languages /> : null}
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" sideOffset={8}>
        <SelectGroup>
          {languageOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export { languageOptions };
