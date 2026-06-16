import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md space-y-3 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          404
        </p>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t("description")}
        </p>
      </div>
    </main>
  );
}
