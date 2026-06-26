import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Mail, Phone, Calendar, CreditCard, User, WalletCards, ShoppingBag, DoorOpen } from "lucide-react";
import { getMember, getMemberPaymentHistory, getMemberVisits } from "@/lib/api/dashboard";
import type { MemberPaymentHistory, MemberVisit } from "@/lib/api/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("MembersPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const memberId = Number(id);
  const [member, paymentHistory, visitsResult] = await Promise.all([
    getMember(memberId),
    getMemberPaymentHistory(memberId),
    getMemberVisits({ memberId: String(memberId), sort: "-check_in_at" }).catch(() => null),
  ]);

  if (!member) {
    notFound();
  }

  const sub = member.latest_subscription;
  const gradient = getAvatarGradient(member.id);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline" className="w-fit gap-2">
          <Link href="/members">
            <ArrowLeft className="size-4" />
            {t("backToMembers")}
          </Link>
        </Button>
      </header>

      <Card>
        <CardContent className="p-6">
          <div
            className={cn(
              "flex flex-col items-center gap-4 sm:flex-row",
              isArabic ? "sm:text-right" : "sm:text-left"
            )}
          >
            <div
              className={cn(
                "flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-2xl font-black text-white shadow-md",
                gradient
              )}
            >
              {member.has_photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getMemberPhotoSrc(member)}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                getInitials(member.name)
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-black tracking-tight">{member.name}</h1>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-bold border shadow-2xs",
                    getStatusStyles(sub?.status || member.status)
                  )}
                >
                  {getStatusLabel(sub?.status || member.status, t)}
                </Badge>
                {sub?.plan_name && (
                  <Badge variant="secondary" className="rounded-md text-xs font-semibold">
                    {sub.plan_name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">
              {t("detailContactTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn("flex items-center gap-3", isArabic && "flex-row-reverse")}>
              <Phone className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">{member.phone || "-"}</span>
            </div>
            <div className={cn("flex items-center gap-3", isArabic && "flex-row-reverse")}>
              <Mail className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">{member.email || "-"}</span>
            </div>
            <div className={cn("flex items-center gap-3", isArabic && "flex-row-reverse")}>
              <User className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium capitalize">
                {member.gender || "-"}
              </span>
            </div>
            <div className={cn("flex items-center gap-3", isArabic && "flex-row-reverse")}>
              <CreditCard className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">{member.national_id || "-"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">
              {t("detailMembershipTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn("flex items-center gap-3", isArabic && "flex-row-reverse")}>
              <Calendar className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t("detailJoinDate")}</p>
                <p className="text-sm font-medium">
                  {member.join_date
                    ? new Date(member.join_date).toLocaleDateString(dateLocale)
                    : "-"}
                </p>
              </div>
            </div>
            <div className={cn("flex items-center gap-3", isArabic && "flex-row-reverse")}>
              <Calendar className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t("detailExpiryDate")}</p>
                <p className="text-sm font-medium">
                  {sub?.end_date
                    ? new Date(sub.end_date).toLocaleDateString(dateLocale)
                    : "-"}
                </p>
              </div>
            </div>
            <div className={cn("flex items-center gap-3", isArabic && "flex-row-reverse")}>
              <CreditCard className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t("detailTotalPaid")}</p>
                <p className="text-sm font-medium">{member.total_paid ?? "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {paymentHistory && (
        <PaymentHistorySection
          history={paymentHistory}
          locale={locale}
          isArabic={isArabic}
          t={t}
        />
      )}

      <VisitHistorySection
        visits={visitsResult?.data ?? []}
        locale={locale}
        isArabic={isArabic}
        t={t}
      />
    </div>
  );
}

function PaymentHistorySection({
  history,
  locale,
  isArabic,
  t,
}: {
  history: MemberPaymentHistory;
  locale: string;
  isArabic: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const stats = [
    {
      label: t("paymentTotalPaid"),
      value: formatCurrency(history.totals.total_paid, locale),
      icon: WalletCards,
    },
    {
      label: t("paymentSubscriptionPaid"),
      value: formatCurrency(history.totals.subscription_paid, locale),
      icon: CreditCard,
    },
    {
      label: t("paymentProductPaid"),
      value: formatCurrency(history.totals.product_paid, locale),
      icon: ShoppingBag,
    },
    {
      label: t("paymentOutstanding"),
      value: formatCurrency(history.totals.outstanding_balance, locale),
      icon: Calendar,
    },
  ];

  return (
    <section className="space-y-4">
      <div className={cn(isArabic && "text-right")}>
        <h2 className="text-xl font-black tracking-tight">{t("paymentHistoryTitle")}</h2>
        <p className="text-sm font-semibold text-muted-foreground">{t("paymentHistoryDescription")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-lg shadow-sm">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className={cn(isArabic && "text-right")}>
                <p className="text-xs font-bold text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-xl font-black tabular-nums">{stat.value}</p>
              </div>
              <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
                <stat.icon className="size-4" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className={cn("text-base font-bold", isArabic && "text-right")}>
              {t("subscriptionPaymentsTitle")}
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("historyDate")}</TableHead>
                <TableHead>{t("historyPlan")}</TableHead>
                <TableHead>{t("historyStatus")}</TableHead>
                <TableHead>{t("historyAmount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.subscription_payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{formatDate(payment.paid_at ?? payment.due_date, locale)}</TableCell>
                  <TableCell>{payment.plan_name ?? `#${payment.subscription_id}`}</TableCell>
                  <TableCell>{payment.status}</TableCell>
                  <TableCell>{formatCurrency(payment.amount, locale)}</TableCell>
                </TableRow>
              ))}
              {history.subscription_payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm font-semibold text-muted-foreground">
                    {t("emptySubscriptionPayments")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className={cn("text-base font-bold", isArabic && "text-right")}>
              {t("productPurchasesTitle")}
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("historyDate")}</TableHead>
                <TableHead>{t("historyItems")}</TableHead>
                <TableHead>{t("historyStatus")}</TableHead>
                <TableHead>{t("historyAmount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.product_purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>{formatDate(purchase.created_at, locale)}</TableCell>
                  <TableCell>{purchase.items.map((item) => `${item.product_name ?? item.product_id} x${item.quantity}`).join(", ")}</TableCell>
                  <TableCell>{purchase.status}</TableCell>
                  <TableCell>{formatCurrency(purchase.total, locale)}</TableCell>
                </TableRow>
              ))}
              {history.product_purchases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm font-semibold text-muted-foreground">
                    {t("emptyProductPurchases")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </section>
  );
}

function VisitHistorySection({
  visits,
  locale,
  isArabic,
  t,
}: {
  visits: MemberVisit[];
  locale: string;
  isArabic: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className={cn("flex items-center gap-2 text-base font-bold", isArabic && "justify-end text-right")}>
          <DoorOpen className="size-4 text-primary" />
          {t("visitHistoryTitle")}
        </CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("visitCheckIn")}</TableHead>
            <TableHead>{t("visitCheckOut")}</TableHead>
            <TableHead>{t("visitStatus")}</TableHead>
            <TableHead>{t("visitAlert")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visits.map((visit) => (
            <TableRow key={visit.id}>
              <TableCell>{formatDateTime(visit.check_in_at, locale)}</TableCell>
              <TableCell>{formatDateTime(visit.check_out_at, locale)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("rounded-md text-xs font-bold", visit.status === "blocked" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
                  {visit.status === "blocked" ? t("visitBlocked") : t("visitAllowed")}
                </Badge>
              </TableCell>
              <TableCell>{visit.alert_reason ?? "-"}</TableCell>
            </TableRow>
          ))}
          {visits.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm font-semibold text-muted-foreground">
                {t("emptyVisits")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function getMemberPhotoSrc(member: { id: number; updated_at?: string }) {
  const version = member.updated_at ? `?v=${encodeURIComponent(member.updated_at)}` : "";
  return `/api/media/members/${member.id}/photo${version}`;
}

const avatarGradients = [
  "from-amber-500 to-rose-500",
  "from-blue-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-purple-500 to-pink-500",
  "from-orange-500 to-yellow-500",
];

function getAvatarGradient(id: number) {
  return avatarGradients[id % avatarGradients.length];
}

function getStatusStyles(statusValue: string) {
  switch (statusValue?.toLowerCase()) {
    case "active":
    case "نشط":
      return "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20";
    case "expired":
    case "inactive":
    case "منتهي":
      return "bg-rose-500/15 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-500/20";
    case "frozen":
    case "suspended":
    case "معلق":
      return "bg-amber-500/15 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-500/20";
    default:
      return "bg-muted text-muted-foreground border-muted-foreground/25";
  }
}

function getStatusLabel(statusValue: string, t: (key: string) => string) {
  switch (statusValue?.toLowerCase()) {
    case "active":
      return t("statusActive");
    case "expired":
    case "inactive":
      return t("statusExpired");
    case "frozen":
    case "suspended":
      return t("statusSuspended");
    default:
      return statusValue;
  }
}

function formatCurrency(value: string | number, locale: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US");
}

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
