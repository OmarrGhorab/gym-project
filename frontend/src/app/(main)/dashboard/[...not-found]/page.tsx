"use client";

import Link from "next/link";

import { ArrowLeft, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  const t = useTranslations("Dashboard.shell.notFound");

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
      <div className="grid size-14 place-items-center rounded-2xl border bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </div>
      <div className="space-y-2">
        <h1 className="font-semibold text-2xl">{t("title")}</h1>
        <p className="max-w-md text-muted-foreground">{t("description")}</p>
      </div>
      <Button nativeButton={false} variant="outline" render={<Link href="/dashboard/default" />}>
        <ArrowLeft data-icon="inline-start" />
        Back to overview
      </Button>
    </div>
  );
}
