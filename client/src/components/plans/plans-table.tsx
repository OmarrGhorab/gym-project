"use client";

import * as React from "react";
import { Edit3, Loader2, Power } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { togglePlan } from "@/lib/actions/plans";
import type { Plan } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";

type PlansTableProps = {
  plans: Plan[];
  onEdit: (plan: Plan) => void;
};

export function PlansTable({ plans, onEdit }: PlansTableProps) {
  const locale = useLocale();
  const t = useTranslations("PlansPage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";

  const columns = React.useMemo<ColumnDef<Plan>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("tablePlan"),
        cell: ({ row }) => {
          const plan = row.original;

          return (
            <div className={cn("min-w-48", isArabic && "text-right")}>
              <p className="text-sm font-bold text-foreground">{plan.name}</p>
              <p className="line-clamp-1 max-w-xs text-xs font-semibold text-muted-foreground">
                {plan.description || t("noDescription")}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "type",
        header: t("tableType"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn("rounded-md border px-2 py-0.5 text-xs font-bold", typeClass(row.original.type))}
          >
            {row.original.type === "offer" ? t("typeOffer") : t("typeMembership")}
          </Badge>
        ),
      },
      {
        accessorKey: "price",
        header: t("tablePrice"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-foreground tabular-nums">
            {formatCurrency(row.original.price, locale)}
          </span>
        ),
      },
      {
        accessorKey: "duration_days",
        header: t("tableDuration"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {t("durationDays", { count: row.original.duration_days })}
          </span>
        ),
      },
      {
        accessorKey: "sessions_count",
        header: t("tableSessions"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {row.original.sessions_count
              ? t("sessionsCount", { count: row.original.sessions_count })
              : t("unlimited")}
          </span>
        ),
      },
      {
        accessorKey: "valid_from",
        header: t("tableValidity"),
        cell: ({ row }) => (
          <div>
            <p className="text-xs font-bold text-foreground tabular-nums">
              {formatDate(row.original.valid_from, dateLocale)}
            </p>
            <p className="text-xs font-semibold text-muted-foreground tabular-nums">
              {formatDate(row.original.valid_to, dateLocale)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "max_freeze_days",
        header: t("tableFreeze"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {t("freezeDays", { count: row.original.max_freeze_days })}
          </span>
        ),
      },
      {
        accessorKey: "is_active",
        header: t("tableStatus"),
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <Badge
              variant="outline"
              className={cn("w-fit rounded-md border px-2 py-0.5 text-xs font-bold", statusClass(row.original.is_active))}
            >
              {row.original.is_active ? t("statusActive") : t("statusInactive")}
            </Badge>
            <span className={cn(
              "text-xs font-semibold",
              row.original.is_sellable ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            )}>
              {row.original.is_sellable ? t("sellable") : t("notSellable")}
            </span>
          </div>
        ),
      },
      {
        id: "actions",
        header: () => (
          <span className={cn("block", isArabic ? "text-left" : "text-right")}>
            {t("tableActions")}
          </span>
        ),
        cell: ({ row }) => (
          <PlanActions plan={row.original} onEdit={onEdit} />
        ),
      },
    ],
    [dateLocale, isArabic, locale, onEdit, t]
  );

  return (
    <DataTable
      columns={columns}
      data={plans}
      emptyMessage={t("empty")}
      isArabic={isArabic}
    />
  );
}

function PlanActions({
  plan,
  onEdit,
}: {
  plan: Plan;
  onEdit: (plan: Plan) => void;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("PlansPage");
  const [isPending, setIsPending] = React.useState(false);

  async function handleToggle() {
    setIsPending(true);

    try {
      await togglePlan(plan.id, locale as AppLocale);
      toast.success(plan.is_active ? t("planDisabledSuccess") : t("planEnabledSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={t("actionEdit")}
        onClick={() => onEdit(plan)}
      >
        <Edit3 className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={plan.is_active ? t("actionDisable") : t("actionEnable")}
        onClick={handleToggle}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
      </Button>
    </div>
  );
}

function formatDate(value: string | null | undefined, locale: string) {
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

function typeClass(type: Plan["type"]) {
  if (type === "offer") {
    return "border-amber-500/20 bg-amber-500/15 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
  }

  return "border-sky-500/20 bg-sky-500/15 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300";
}

function statusClass(isActive: boolean) {
  return isActive
    ? "border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
    : "border-slate-500/20 bg-slate-500/15 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300";
}
