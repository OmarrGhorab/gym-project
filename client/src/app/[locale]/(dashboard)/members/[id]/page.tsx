import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Mail, Phone, Calendar, CreditCard, User } from "lucide-react";
import { getMember } from "@/lib/api/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const member = await getMember(Number(id));

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
    </div>
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
