"use client";

import { useEffect, useState } from "react";

import { useLocale } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import type { AppLocale } from "@/i18n/config";

export const LOCALE_SWITCH_START = "dashboard-locale-switch-start";
export const LOCALE_SWITCH_END = "dashboard-locale-switch-end";
const sidebarSkeletons = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const metricSkeletons = ["first", "second", "third"];
const rowSkeletons = ["one", "two", "three", "four", "five", "six", "seven"];

/**
 * Covers the dashboard while its server-rendered locale is being refreshed.
 * This prevents the old page from briefly being laid out in the new direction.
 */
export function LocaleSwitchOverlay() {
  const locale = useLocale() as AppLocale;
  const [isSwitching, setIsSwitching] = useState(false);
  const [targetLocale, setTargetLocale] = useState<AppLocale | null>(null);

  useEffect(() => {
    const start = (event: Event) => {
      setTargetLocale((event as CustomEvent<AppLocale>).detail);
      setIsSwitching(true);
    };
    const end = () => {
      setTargetLocale(null);
      setIsSwitching(false);
    };

    window.addEventListener(LOCALE_SWITCH_START, start);
    window.addEventListener(LOCALE_SWITCH_END, end);

    return () => {
      window.removeEventListener(LOCALE_SWITCH_START, start);
      window.removeEventListener(LOCALE_SWITCH_END, end);
    };
  }, []);

  useEffect(() => {
    if (targetLocale !== null && locale === targetLocale) {
      setTargetLocale(null);
      setIsSwitching(false);
    }
  }, [locale, targetLocale]);

  if (!isSwitching) {
    return null;
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
      className="fixed inset-0 z-[100] bg-background/95 p-4 backdrop-blur-sm md:p-6"
    >
      <div className="flex h-full min-h-0 gap-4">
        <aside className="hidden w-60 shrink-0 rounded-xl border bg-card/60 p-4 lg:grid lg:content-start lg:gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-3 pt-4">
            {sidebarSkeletons.map((key) => (
              <Skeleton key={key} className="h-5 w-full" />
            ))}
          </div>
        </aside>
        <main className="grid min-w-0 flex-1 content-start gap-5">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {metricSkeletons.map((key) => (
              <Skeleton key={key} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="rounded-xl border bg-card/60 p-4">
            <Skeleton className="mb-5 h-6 w-48" />
            <div className="grid gap-4">
              {rowSkeletons.map((key) => (
                <Skeleton key={key} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
