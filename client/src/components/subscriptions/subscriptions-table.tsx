"use client";

import * as React from "react";
import { Loader2, PauseCircle, PlayCircle, RotateCw, Snowflake, Square } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  freezeSubscription,
  stopSubscription,
  unfreezeSubscription,
} from "@/lib/actions/subscriptions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { Subscription } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type SubscriptionsTableProps = {
  subscriptions: Subscription[];
};

export function SubscriptionsTable({ subscriptions }: SubscriptionsTableProps) {
  const locale = useLocale();
  const t = useTranslations("SubscriptionsPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<Subscription>[]>(
    () => [
      {
        accessorKey: "member",
        header: t("tableMember"),
        cell: ({ row }) => {
          const subscription = row.original;
          const member = subscription.member;
          const name = member?.name ?? t("unknownMember");

          return (
            <div className={cn("flex items-center gap-3", isArabic && "flex-row-reverse text-right")}>
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-black text-primary">
                {getInitials(name)}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{name}</p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {member?.phone ?? member?.email ?? `#${subscription.id}`}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "plan",
        header: t("tablePlan"),
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-bold text-foreground/85">
              {row.original.plan?.name ?? "-"}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {row.original.plan?.duration_days
                ? t("durationDays", { count: row.original.plan.duration_days })
                : "-"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("tableStatus"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn("rounded-md border px-2 py-0.5 text-xs font-bold", statusClass(row.original.status))}
          >
            {statusLabel(row.original.status, t)}
          </Badge>
        ),
      },
      {
        accessorKey: "start_date",
        header: t("tableStart"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatDate(row.original.start_date, dateLocale)}
          </span>
        ),
      },
      {
        accessorKey: "end_date",
        header: t("tableEnd"),
        cell: ({ row }) => {
          const days = getDaysLeft(row.original.end_date);

          return (
            <div>
              <p className="text-xs font-bold text-foreground tabular-nums">
                {formatDate(row.original.end_date, dateLocale)}
              </p>
              <p className={cn("text-xs font-semibold", days <= 7 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                {days < 0 ? t("expiredAgo", { count: Math.abs(days) }) : t("daysLeft", { count: days })}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "price_paid",
        header: t("tableTotal"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-foreground tabular-nums">
            {formatCurrency(row.original.price_paid, locale)}
          </span>
        ),
      },
      {
        accessorKey: "sold_by",
        header: t("tableSoldBy"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground">
            {row.original.sold_by?.name ?? "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => (
          <span className={cn("block", isArabic ? "text-left" : "text-right")}>
            {t("tableActions")}
          </span>
        ),
        cell: ({ row }) => <SubscriptionActions subscription={row.original} />,
      },
    ],
    [dateLocale, isArabic, locale, t]
  );

  return (
    <DataTable
      columns={columns}
      data={subscriptions}
      emptyMessage={t("empty")}
      isArabic={isArabic}
    />
  );
}

function SubscriptionActions({ subscription }: { subscription: Subscription }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("SubscriptionsPage");
  const [pendingAction, setPendingAction] = React.useState<"freeze" | "unfreeze" | "stop" | null>(null);
  const status = subscription.status;
  const normalized = status.toLowerCase();
  const isPending = pendingAction !== null;

  async function handleFreeze() {
    const freezeStart = window.prompt(t("freezeStartPrompt"));
    if (!freezeStart) return;
    const freezeEnd = window.prompt(t("freezeEndPrompt"), freezeStart);
    if (!freezeEnd) return;
    const reason = window.prompt(t("freezeReasonPrompt")) ?? undefined;

    setPendingAction("freeze");
    try {
      await freezeSubscription(
        subscription.id,
        { freeze_start: freezeStart, freeze_end: freezeEnd, reason },
        locale as AppLocale
      );
      toast.success(t("subscriptionFrozenSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUnfreeze() {
    const confirmed = window.confirm(t("unfreezeConfirm", { id: subscription.id }));
    if (!confirmed) return;

    setPendingAction("unfreeze");
    try {
      await unfreezeSubscription(subscription.id, locale as AppLocale);
      toast.success(t("subscriptionUnfrozenSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleStop() {
    const confirmed = window.confirm(t("stopConfirm", { id: subscription.id }));
    if (!confirmed) return;

    setPendingAction("stop");
    try {
      await stopSubscription(subscription.id, locale as AppLocale);
      toast.success(t("subscriptionStoppedSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button variant="ghost" size="icon-sm" title={t("actionRenew")} disabled>
        <RotateCw className="size-3.5" />
      </Button>
      {normalized === "frozen" ? (
        <Button variant="ghost" size="icon-sm" title={t("actionUnfreeze")} onClick={handleUnfreeze} disabled={isPending}>
          {pendingAction === "unfreeze" ? <Loader2 className="size-3.5 animate-spin" /> : <PlayCircle className="size-3.5" />}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          title={t("actionFreeze")}
          onClick={handleFreeze}
          disabled={isPending || normalized !== "active"}
        >
          {pendingAction === "freeze" ? <Loader2 className="size-3.5 animate-spin" /> : <Snowflake className="size-3.5" />}
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        title={t("actionStop")}
        onClick={handleStop}
        disabled={isPending || normalized === "stopped"}
      >
        {pendingAction === "stop" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : normalized === "stopped" ? (
          <PauseCircle className="size-3.5" />
        ) : (
          <Square className="size-3.5" />
        )}
      </Button>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
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

function formatCurrency(value: string | number, locale: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "-";

  return amount.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });
}

function getDaysLeft(value: string) {
  const end = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (Number.isNaN(end.getTime())) {
    return 0;
  }

  return Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function statusLabel(status: string, t: (key: string) => string) {
  switch (status.toLowerCase()) {
    case "active":
      return t("statusActive");
    case "frozen":
      return t("statusFrozen");
    case "expired":
      return t("statusExpired");
    case "stopped":
      return t("statusStopped");
    default:
      return status || "-";
  }
}

function statusClass(status: string) {
  switch (status.toLowerCase()) {
    case "active":
      return "border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "frozen":
      return "border-sky-500/20 bg-sky-500/15 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400";
    case "expired":
      return "border-rose-500/20 bg-rose-500/15 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400";
    case "stopped":
      return "border-slate-500/20 bg-slate-500/15 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300";
    default:
      return "border-muted-foreground/25 bg-muted text-muted-foreground";
  }
}
