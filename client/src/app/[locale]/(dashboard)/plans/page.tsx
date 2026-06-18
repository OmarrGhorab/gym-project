import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Tags,
} from "lucide-react";
import {
  getPlansPaginated,
  type Paginated,
  type Plan,
} from "@/lib/api/dashboard";
import { PlansFilterBar } from "@/components/plans/plans-filter-bar";
import { PlansPagination } from "@/components/plans/plans-pagination";
import { PlansTableContainer } from "@/components/plans/plans-table-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PlansPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function PlansPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string;
    type?: string;
    status?: string;
    sort?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("PlansPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const type = normalizeType(resolvedSearchParams.type);
  const isActive = normalizeStatus(resolvedSearchParams.status);
  const sort = normalizeSort(resolvedSearchParams.sort);
  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let plans: Plan[] = [];
  let meta: Paginated<Plan>["meta"] = {
    current_page: 1,
    per_page: 15,
    total: 0,
    last_page: 1,
  };
  let fetchError: string | null = null;

  try {
    const plansResult = await getPlansPaginated({ page, type, isActive, sort });
    plans = plansResult.data;
    meta = plansResult.meta;
  } catch {
    fetchError = t("fetchError");
  }

  const activePlans = plans.filter((plan) => plan.is_active).length;
  const sellablePlans = plans.filter((plan) => plan.is_sellable).length;
  const offerPlans = plans.filter((plan) => plan.type === "offer").length;
  const averagePrice =
    plans.length > 0
      ? plans.reduce((sum, plan) => {
          const price = Number(plan.price);
          return Number.isFinite(price) ? sum + price : sum;
        }, 0) / plans.length
      : 0;

  const stats = [
    {
      label: t("statTotal"),
      value: meta.total,
      hint: t("statTotalHint"),
      icon: ClipboardList,
      className: "bg-primary/15 text-primary",
    },
    {
      label: t("statActive"),
      value: activePlans,
      hint: t("statActiveHint"),
      icon: Dumbbell,
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("statSellable"),
      value: sellablePlans,
      hint: t("statSellableHint"),
      icon: CalendarDays,
      className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    {
      label: t("statOffers"),
      value: offerPlans,
      hint: formatCurrency(averagePrice, locale),
      icon: Tags,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className={cn(isArabic && "text-right")}>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            {isArabic ? (
              <>
                <span>{dateLabel}</span>
                <span className="text-muted-foreground/30">/</span>
                <span className="font-bold text-primary">{t("breadcrumb")}</span>
              </>
            ) : (
              <>
                <span className="font-bold text-primary">{t("breadcrumb")}</span>
                <span className="text-muted-foreground/30">/</span>
                <span>{dateLabel}</span>
              </>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-lg shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-bold text-card-foreground">
                {stat.label}
              </CardTitle>
              <span className={cn("grid size-8 place-items-center rounded-lg", stat.className)}>
                <stat.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black tracking-tight text-foreground tabular-nums">
                {typeof stat.value === "number" ? stat.value.toLocaleString(dateLocale) : stat.value}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {stat.hint}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border shadow-xs">
        <CardContent className="p-4">
          <PlansFilterBar />
        </CardContent>
      </Card>

      {fetchError && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {fetchError}
        </div>
      )}

      <Card className="overflow-hidden border shadow-xs">
        <div className="border-b bg-muted/15 px-4 py-4">
          <div className={cn(isArabic && "text-right")}>
            <h2 className="text-base font-black text-foreground">{t("tableTitle")}</h2>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("tableDescription", { count: meta.total })}
            </p>
          </div>
        </div>
        <PlansTableContainer plans={plans} />
        <PlansPagination
          currentPage={meta.current_page || 1}
          lastPage={meta.last_page || 1}
        />
      </Card>
    </div>
  );
}

function normalizeType(value?: string) {
  return value === "membership" || value === "offer" ? value : undefined;
}

function normalizeStatus(value?: string) {
  return value === "1" || value === "0" ? value : undefined;
}

function normalizeSort(value?: string) {
  const allowed = new Set(["name", "-name", "price", "-price", "duration_days", "-duration_days", "created_at", "-created_at"]);
  return allowed.has(value ?? "") ? value as "name" | "-name" | "price" | "-price" | "duration_days" | "-duration_days" | "created_at" | "-created_at" : "-created_at";
}

function formatCurrency(value: number, locale: string) {
  return value.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });
}
