"use client";

import { Quote } from "lucide-react";
import { useTranslations } from "next-intl";

export function QuoteCard({ focus }: { focus: string }) {
  const t = useTranslations("Dashboard.productivity");

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-xs">
      <div className="flex items-start gap-4">
        <div className="grid size-8 shrink-0 place-items-center text-muted-foreground">
          <Quote className="size-6" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xl leading-tight tracking-tight">{t("quote")}</p>
          <p className="text-muted-foreground">{focus}</p>
        </div>
      </div>
    </section>
  );
}
