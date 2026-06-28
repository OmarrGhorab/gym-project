import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HomeIcon, Settings } from "lucide-react";
import Breadcrumb3 from "@/components/ui/breadcrumb-3";
import { SettingsForms } from "@/components/settings/settings-forms";
import { getSettings, type AppSettings } from "@/lib/api/dashboard";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SettingsPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("SettingsPage");
  const shellT = await getTranslations("DashboardShell");
  const user = await getCurrentUser();
  const isArabic = locale === "ar";
  const canManageSettings = user?.permissions?.includes("settings.manage") || user?.role === "owner";

  let settings: AppSettings | null = null;
  let fetchError: string | null = null;

  if (canManageSettings) {
    try {
      settings = await getSettings();
    } catch {
      fetchError = t("fetchError");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className={cn("space-y-3", isArabic && "text-right")}>
        <Breadcrumb3
          segments={[
            { label: shellT("nav.dashboard"), href: `/${locale}`, icon: HomeIcon },
            { label: shellT("nav.settings"), icon: Settings, current: true },
          ]}
        />
        <div className={cn("flex items-start gap-3", isArabic && "flex-row-reverse")}>
          <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Settings className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-black tracking-normal text-foreground">{t("title")}</h1>
            <p className="max-w-3xl text-sm font-semibold leading-6 text-muted-foreground">
              {t("description")}
            </p>
          </div>
        </div>
      </header>

      {fetchError ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          {fetchError}
        </div>
      ) : null}

      <SettingsForms settings={settings} canManageSettings={Boolean(canManageSettings)} />
    </div>
  );
}
