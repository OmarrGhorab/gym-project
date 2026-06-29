"use client";

import { useRouter } from "next/navigation";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type AppLocale, getLocaleDirection } from "@/i18n/config";

const languageOptions: { label: string; value: AppLocale }[] = [
  { label: "English", value: "en" },
  { label: "العربية", value: "ar" },
];

export function LanguageSelector({ className, showIcon = true }: { className?: string; showIcon?: boolean }) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;

  async function updateLocale(nextLocale: AppLocale) {
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = getLocaleDirection(nextLocale);

    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: nextLocale }),
    });

    router.refresh();
  }

  return (
    <Select value={locale} onValueChange={(value) => updateLocale(value as AppLocale)}>
      <SelectTrigger size="sm" aria-label="Select language" className={className}>
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
