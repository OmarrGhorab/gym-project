"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { MemberRowActions } from "@/components/members/member-row-actions";
import type { Member } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type MembersTableProps = {
  members: Member[];
  onEditMember?: (member: Member) => void;
  onMutate?: () => void;
};

export function MembersTable({
  members,
  onEditMember,
  onMutate,
}: MembersTableProps) {
  const locale = useLocale();
  const t = useTranslations("MembersPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<Member>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("tableHeaderName"),
        cell: ({ row }) => {
          const member = row.original;
          const gradient = getAvatarGradient(member.id);

          return (
            <div
              className={cn(
                "flex items-center gap-3",
                isArabic ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-xs font-black text-white shadow-xs",
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
              <div>
                <p className="text-sm font-bold text-foreground">{member.name}</p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {member.email || "-"}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "phone",
        header: t("tableHeaderPhone"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {row.original.phone || "-"}
          </span>
        ),
      },
      {
        accessorKey: "gender",
        header: t("tableHeaderGender"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground">
            {getGenderLabel(row.original.gender, t)}
          </span>
        ),
      },
      {
        accessorKey: "join_date",
        header: t("tableHeaderJoinDate"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatDate(row.original.join_date, dateLocale)}
          </span>
        ),
      },
      {
        accessorKey: "member_status",
        header: t("tableHeaderMemberStatus"),
        cell: ({ row }) => {
          const memberStatus = row.original.status;
          return (
            <Badge
              variant="outline"
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-bold border shadow-2xs",
                getMemberStatusStyles(memberStatus)
              )}
            >
              {getMemberStatusLabel(memberStatus, t)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "latest_subscription",
        header: t("tableHeaderPlan"),
        cell: ({ row }) => {
          const planName = row.original.latest_subscription?.plan_name;
          return (
            <span className="text-sm font-bold text-foreground/80">
              {planName || t("noSubscription")}
            </span>
          );
        },
      },
      {
        accessorKey: "subscription_status",
        header: t("tableHeaderSubscriptionStatus"),
        cell: ({ row }) => {
          const subscriptionStatus = getEffectiveSubscriptionStatus(row.original);
          return (
            <Badge
              variant="outline"
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-bold border shadow-2xs",
                getSubscriptionStatusStyles(subscriptionStatus)
              )}
            >
              {getSubscriptionStatusLabel(subscriptionStatus, t)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "latest_subscription.end_date",
        header: t("tableHeaderExpiry"),
        cell: ({ row }) => {
          const endDate = row.original.latest_subscription?.end_date;
          if (!endDate) return <span className="text-xs text-muted-foreground">-</span>;
          return (
            <span className="text-xs font-bold text-muted-foreground tabular-nums">
              {new Date(endDate).toLocaleDateString(dateLocale, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => (
          <span className={cn("block", isArabic ? "text-left" : "text-right")}>
            {t("tableHeaderActions")}
          </span>
        ),
        cell: ({ row }) => (
          <MemberRowActions
            member={row.original}
            onEdit={onEditMember}
            onMutate={onMutate}
          />
        ),
      },
    ],
    [t, isArabic, dateLocale, onEditMember, onMutate]
  );

  return (
    <DataTable
      columns={columns}
      data={members}
      emptyMessage={t("noData")}
      isArabic={isArabic}
    />
  );
}

function getEffectiveSubscriptionStatus(member: Member) {
  const subscription = member.latest_subscription;

  if (!subscription) {
    return "none";
  }

  if (subscription.status?.toLowerCase() !== "active" || !subscription.end_date) {
    return subscription.status || member.status;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiryDate = new Date(subscription.end_date);
  if (Number.isNaN(expiryDate.getTime())) {
    return subscription.status || member.status;
  }

  expiryDate.setHours(0, 0, 0, 0);

  return expiryDate < today ? "expired" : subscription.status;
}

function formatDate(value: string | undefined, locale: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getGenderLabel(gender: string | undefined, t: (key: string) => string) {
  switch (gender?.toLowerCase()) {
    case "male":
      return t("filterGenderMale");
    case "female":
      return t("filterGenderFemale");
    default:
      return "-";
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function getMemberPhotoSrc(member: Member) {
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

function getMemberStatusStyles(statusValue: string) {
  switch (statusValue?.toLowerCase()) {
    case "active":
    case "نشط":
      return "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20";
    case "inactive":
    case "غير نشط":
      return "bg-slate-500/15 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300 border-slate-500/20";
    default:
      return "bg-muted text-muted-foreground border-muted-foreground/25";
  }
}

function getSubscriptionStatusStyles(statusValue: string) {
  switch (statusValue?.toLowerCase()) {
    case "active":
    case "نشط":
      return "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20";
    case "expired":
    case "منتهي":
      return "bg-rose-500/15 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-500/20";
    case "frozen":
    case "suspended":
    case "معلق":
      return "bg-amber-500/15 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border-amber-500/20";
    case "stopped":
      return "bg-slate-500/15 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300 border-slate-500/20";
    case "none":
      return "bg-muted text-muted-foreground border-muted-foreground/25";
    default:
      return "bg-muted text-muted-foreground border-muted-foreground/25";
  }
}

function getMemberStatusLabel(statusValue: string, t: (key: string) => string) {
  switch (statusValue?.toLowerCase()) {
    case "active":
      return t("statusActive");
    case "inactive":
      return t("statusInactive");
    default:
      return statusValue || "-";
  }
}

function getSubscriptionStatusLabel(statusValue: string, t: (key: string) => string) {
  switch (statusValue?.toLowerCase()) {
    case "active":
      return t("statusActive");
    case "expired":
      return t("statusExpired");
    case "frozen":
    case "suspended":
      return t("statusSuspended");
    case "stopped":
      return t("statusStopped");
    case "none":
      return t("noSubscription");
    default:
      return statusValue || "-";
  }
}
