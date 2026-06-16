import { getTranslations, setRequestLocale } from "next-intl/server";
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,199,67,0.22),_transparent_35%),linear-gradient(180deg,_#f8f4e8_0%,_#f3efe1_46%,_#efe8d3_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between rounded-2xl border border-black/8 bg-white/70 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-sm font-semibold text-[#f3d45a]">
              ATP
            </div>
            <div>
              <p className="text-sm font-semibold">{t("brand")}</p>
              <p className="text-xs text-slate-500">{t("subtitle")}</p>
            </div>
          </div>
          <Button variant="outline" className="rounded-full px-4">
            {t("cta")}
          </Button>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
              {t("eyebrow")}
            </p>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] sm:text-6xl">
                {t("title")}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                {t("description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-full px-5">{t("primaryAction")}</Button>
              <Button variant="outline" className="rounded-full px-5">
                {t("secondaryAction")}
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[28px] border border-black/10 bg-[#0f1115] p-5 text-white shadow-[0_28px_55px_rgba(15,17,21,0.22)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/60">{t("stats.revenue")}</p>
                  <p className="mt-2 text-4xl font-semibold">EGP 48,320</p>
                </div>
                <div className="rounded-full bg-[#f3d45a] px-3 py-1 text-xs font-semibold text-black">
                  +18.4%
                </div>
              </div>
              <div className="mt-6 h-28 rounded-2xl bg-[linear-gradient(180deg,rgba(243,212,90,0.34),rgba(243,212,90,0.05))]" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-[24px] border border-black/8 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                <p className="text-sm text-slate-500">{t("stats.salesToday")}</p>
                <p className="mt-3 text-3xl font-semibold">27</p>
              </article>
              <article className="rounded-[24px] border border-black/8 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                <p className="text-sm text-slate-500">
                  {t("stats.activeSubscriptions")}
                </p>
                <p className="mt-3 text-3xl font-semibold">186</p>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
