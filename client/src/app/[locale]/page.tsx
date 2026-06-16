import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,232,96,0.14),_transparent_24%),linear-gradient(180deg,_#090909_0%,_#111111_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
        <section className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-white/6 px-8 py-12 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur sm:px-12">
          <div className="space-y-6">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#ffe46b]">
              {t("eyebrow")}
            </p>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] sm:text-6xl">
                {t("title")}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-white/70">
                {t("description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                className="rounded-full bg-[#ffe800] px-5 text-black hover:bg-[#f5de00]"
              >
                <Link href="/login">{t("primaryAction")}</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full px-5">
                <Link href="/login">{t("secondaryAction")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
