import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Percent, ReceiptText, UserRound, WalletCards } from "lucide-react";
import { CommissionsActions } from "@/components/commissions/commissions-actions";
import { CommissionsFilterBar } from "@/components/commissions/commissions-filter-bar";
import { CommissionsPagination } from "@/components/commissions/commissions-pagination";
import { CommissionsTable } from "@/components/commissions/commissions-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommissions, type Commission, type Paginated } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "CommissionsPage" });
  return { title: t("metadataTitle"), description: t("metadataDescription") };
}

export default async function CommissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; employee_id?: string; month?: string; status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("CommissionsPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const employeeId = normalizeEmployeeId(resolvedSearchParams.employee_id);
  const month = normalizeMonth(resolvedSearchParams.month);
  const status = normalizeStatus(resolvedSearchParams.status);

  let commissions: Commission[] = [];
  let meta: Paginated<Commission>["meta"] = { current_page: 1, per_page: 15, total: 0, last_page: 1 };
  let totalAmount = "0.00";
  let fetchError: string | null = null;

  if (employeeId) {
    try {
      const result = await getCommissions({ employeeId, page, month, status });
      commissions = result.data;
      meta = result.meta;
      totalAmount = result.total_amount;
    } catch {
      fetchError = t("fetchError");
    }
  }

  const pendingCount = commissions.filter((item) => item.status !== "paid").length;
  const averageRate = commissions.length
    ? commissions.reduce((sum, item) => sum + Number(item.rate), 0) / commissions.length
    : 0;

  const stats = [
    { label: t("statTotal"), value: meta.total, hint: t("statTotalHint"), icon: ReceiptText, className: "bg-primary/15 text-primary" },
    { label: t("statAmount"), value: formatCurrency(totalAmount, locale), hint: t("statAmountHint"), icon: WalletCards, className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    { label: t("statPending"), value: pendingCount, hint: t("statPendingHint"), icon: Percent, className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
    { label: t("statEmployee"), value: employeeId ?? "-", hint: t("statEmployeeHint", { rate: (averageRate * 100).toFixed(2) }), icon: UserRound, className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className={cn(isArabic && "text-right")}>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">{t("description")}</p>
        </div>
        <CommissionsActions />
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-lg shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-bold text-card-foreground">{stat.label}</CardTitle>
              <span className={cn("grid size-8 place-items-center rounded-lg", stat.className)}><stat.icon className="size-4" /></span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black tracking-tight text-foreground tabular-nums">{typeof stat.value === "number" ? stat.value.toLocaleString(dateLocale) : stat.value}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border shadow-xs"><CardContent className="p-4"><CommissionsFilterBar /></CardContent></Card>
      {!employeeId && <div className="rounded-md bg-muted/30 p-4 text-sm font-semibold text-muted-foreground">{t("employeeRequired")}</div>}
      {fetchError && <div className="rounded-md bg-destructive/10 p-4 text-sm font-medium text-destructive">{fetchError}</div>}
      <Card className="overflow-hidden border shadow-xs">
        <div className="border-b bg-muted/15 px-4 py-4">
          <div className={cn(isArabic && "text-right")}>
            <h2 className="text-base font-black text-foreground">{t("tableTitle")}</h2>
            <p className="text-xs font-semibold text-muted-foreground">{t("tableDescription", { count: meta.total })}</p>
          </div>
        </div>
        <CommissionsTable commissions={commissions} />
        <CommissionsPagination currentPage={meta.current_page || 1} lastPage={meta.last_page || 1} />
      </Card>
    </div>
  );
}

function normalizeEmployeeId(value?: string) {
  return value && /^[1-9][0-9]*$/.test(value) ? value : undefined;
}

function normalizeMonth(value?: string) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : undefined;
}

function normalizeStatus(value?: string) {
  return value === "paid" || value === "pending" ? value : undefined;
}

function formatCurrency(value: string | number, locale: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });
}
