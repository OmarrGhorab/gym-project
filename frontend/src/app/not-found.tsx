"use client";

import Link from "next/link";

import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("Dashboard.shell");

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl border bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </div>
      <div className="space-y-2">
        <h1 className="font-semibold text-2xl">{t("pageNotFoundTitle")}</h1>
        <p className="text-muted-foreground">{t("pageNotFoundDescription")}</p>
      </div>
      <Link prefetch={false} replace href="/dashboard/default">
        <Button variant="outline">{t("goBackHome")}</Button>
      </Link>
    </div>
  );
}
