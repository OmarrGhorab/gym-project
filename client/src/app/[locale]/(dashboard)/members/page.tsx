import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Users } from "lucide-react";
import { getMembers, getPlans, type Member, type Paginated, type Plan } from "@/lib/api/dashboard";
import { MembersFilterBar } from "@/components/dashboard/members-filter-bar";
import { MembersTableContainer } from "@/components/members/members-table-container";
import Breadcrumb3 from "@/components/ui/breadcrumb-3";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "MembersPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    gender?: string;
    plan_id?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("MembersPage");
  const shellT = await getTranslations("DashboardShell");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const search = resolvedSearchParams.search || undefined;
  const status = resolvedSearchParams.status || undefined;
  const gender = resolvedSearchParams.gender || undefined;
  const planId = resolvedSearchParams.plan_id || undefined;

  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let plans: Plan[] = [];
  let members: Member[] = [];
  let meta: Paginated<Member>["meta"] = {
    current_page: 1,
    per_page: 15,
    total: 0,
    last_page: 1,
  };
  let fetchError: string | null = null;

  try {
    const [plansResult, membersResult] = await Promise.all([
      getPlans().catch(() => [] as Plan[]),
      getMembers({
        page,
        search,
        status: status === "all" ? undefined : status,
        gender: gender === "all" ? undefined : gender,
        planId: planId === "all" ? undefined : planId,
      }),
    ]);

    plans = plansResult;
    members = membersResult.data;
    meta = membersResult.meta;
  } catch {
    fetchError = t("fetchError");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className={cn(isArabic ? "text-right" : "text-left")}>
          <Breadcrumb3
            homeHref={`/${locale}`}
            homeLabel={shellT("nav.dashboard")}
            currentLabel={t("title")}
            currentIcon={Users}
            dateLabel={dateLabel}
            className={cn(isArabic && "flex justify-end")}
          />
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {t("totalMembers", { count: meta.total })}
          </p>
        </div>
      </header>

      <Card className="border shadow-xs">
        <CardContent className="p-4">
          <MembersFilterBar plans={plans} />
        </CardContent>
      </Card>

      {fetchError && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {fetchError}
        </div>
      )}

      <Card className="overflow-hidden border shadow-xs">
        <MembersTableContainer
          members={members}
          meta={meta}
          plans={plans}
          filters={{
            search,
            status,
            gender,
            planId,
          }}
        />
      </Card>
    </div>
  );
}
