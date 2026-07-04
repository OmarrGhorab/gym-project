import type { ReactNode } from "react";

import { cookies } from "next/headers";

import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_CONFIG } from "@/config/app-config";
import { defaultLocale, getLocaleDirection, isAppLocale, localeCookieName } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";
import { fontVars } from "@/lib/fonts/registry";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: APP_CONFIG.meta.title,
  description: APP_CONFIG.meta.description,
};

function readPreferenceCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  key: keyof typeof PREFERENCE_DEFAULTS,
): string {
  return cookieStore.get(key)?.value ?? PREFERENCE_DEFAULTS[key];
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale = isAppLocale(cookieLocale) ? cookieLocale : defaultLocale;
  const messages = await getMessages(locale);

  const themeMode = readPreferenceCookie(cookieStore, "theme_mode");
  const themePreset = readPreferenceCookie(cookieStore, "theme_preset");
  const font = readPreferenceCookie(cookieStore, "font");
  const contentLayout = readPreferenceCookie(cookieStore, "content_layout");
  const navbarStyle = readPreferenceCookie(cookieStore, "navbar_style");
  const sidebarVariant = readPreferenceCookie(cookieStore, "sidebar_variant");
  const sidebarCollapsible = readPreferenceCookie(cookieStore, "sidebar_collapsible");

  const resolvedDarkClass = themeMode === "dark" ? "dark" : undefined;

  return (
    <html
      lang={locale}
      dir={getLocaleDirection(locale)}
      data-theme-mode={themeMode}
      data-theme-preset={themePreset}
      data-content-layout={contentLayout}
      data-navbar-style={navbarStyle}
      data-sidebar-variant={sidebarVariant}
      data-sidebar-collapsible={sidebarCollapsible}
      data-font={font}
      className={resolvedDarkClass}
      suppressHydrationWarning
    >
      <body className={`${fontVars} min-h-screen antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <TooltipProvider>
            <PreferencesStoreProvider
              themeMode={themeMode as typeof PREFERENCE_DEFAULTS.theme_mode}
              themePreset={themePreset as typeof PREFERENCE_DEFAULTS.theme_preset}
              contentLayout={contentLayout as typeof PREFERENCE_DEFAULTS.content_layout}
              navbarStyle={navbarStyle as typeof PREFERENCE_DEFAULTS.navbar_style}
              font={font as typeof PREFERENCE_DEFAULTS.font}
            >
              {children}
              <Toaster />
            </PreferencesStoreProvider>
          </TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
