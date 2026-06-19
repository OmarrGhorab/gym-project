import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Download, FileSpreadsheet, ShieldCheck, Timer } from "lucide-react";
import { ExportRequestPanel } from "@/components/exports/export-request-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ExportsPage" });
  return { title: t("metadataTitle"), description: t("metadataDescription") };
}

export default async function ExportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ExportsPage");
  const isArabic = locale === "ar";

  const stats = [
    { label: t("statResources"), value: 6, hint: t("statResourcesHint"), icon: FileSpreadsheet, className: "bg-primary/15 text-primary" },
    { label: t("statFormats"), value: 3, hint: t("statFormatsHint"), icon: Download, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    { label: t("statRetention"), value: "24h", hint: t("statRetentionHint"), icon: Timer, className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
    { label: t("statAccess"), value: t("statAccessValue"), hint: t("statAccessHint"), icon: ShieldCheck, className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className={cn(isArabic && "text-right")}>
        <h1 className="text-3xl font-black tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">{t("description")}</p>
      </header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-lg shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-bold text-card-foreground">{stat.label}</CardTitle>
              <span className={cn("grid size-8 place-items-center rounded-lg", stat.className)}><stat.icon className="size-4" /></span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black tracking-tight text-foreground tabular-nums">{stat.value}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <Card className="border shadow-xs">
        <div className="border-b bg-muted/15 px-4 py-4">
          <h2 className={cn("text-base font-black text-foreground", isArabic && "text-right")}>{t("panelTitle")}</h2>
          <p className={cn("text-xs font-semibold text-muted-foreground", isArabic && "text-right")}>{t("panelDescription")}</p>
        </div>
        <CardContent className="p-4">
          <ExportRequestPanel />
        </CardContent>
      </Card>
    </div>
  );
}
