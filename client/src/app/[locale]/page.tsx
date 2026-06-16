import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/session";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata.Dashboard" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAuth(locale as AppLocale);
  setRequestLocale(locale);
  const t = await getTranslations("Dashboard");

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit">
              {t("eyebrow")}
            </Badge>
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                {t("title")}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {t("description")}
              </p>
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {t("today")}
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {["members", "revenue", "subscriptions", "branches"].map((key) => (
            <Card key={key} className="rounded-lg">
              <CardHeader className="space-y-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t(`stats.${key}.label`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-3xl font-semibold">
                  {t(`stats.${key}.value`)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(`stats.${key}.hint`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>{t("activity.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {["checkins", "renewals", "payments"].map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{t(`activity.${key}.title`)}</p>
                    <p className="text-sm text-muted-foreground">
                      {t(`activity.${key}.description`)}
                    </p>
                  </div>
                  <Badge variant="outline">{t(`activity.${key}.status`)}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>{t("actions.title")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {["members", "subscriptions", "reports"].map((key) => (
                <div
                  key={key}
                  className="rounded-md border border-border bg-muted/40 p-4"
                >
                  <p className="font-medium">{t(`actions.${key}.title`)}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(`actions.${key}.description`)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
