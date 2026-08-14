"use client";
"use no memo";

import type { ColumnDef } from "@tanstack/react-table";
import { differenceInCalendarDays, endOfToday, parseISO } from "date-fns";
import { CircleAlertIcon, CircleCheckIcon, Clock3Icon, LoaderIcon, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import type { RecentCustomerRow } from "./schema";

type RecentCustomersColumnLabels = {
  actions: string;
  billing: string;
  billingStatuses: Record<string, string>;
  contactMissing: string;
  dateMissing: string;
  endsAt: (values: { date: string }) => string;
  startsAt: (values: { date: string }) => string;
  joined: string;
  member: string;
  noPlan: string;
  pausedDaysRemaining: (values: { count: number }) => string;
  paidAmount: (values: { amount: string }) => string;
  freezeApprovalPending: string;
  plan: string;
  selectAll: string;
  selectMember: (values: { name: string }) => string;
  sessionTiming: string;
  sessionTimingDetails: Record<string, (count: number) => string>;
  sessionTimingStatuses: Record<string, string>;
  status: string;
  statuses: Record<string, string>;
};

function billingIcon(billing: string) {
  switch (billing) {
    case "paid":
      return <CircleCheckIcon className="fill-green-500 stroke-primary-foreground dark:fill-green-600" />;
    case "pending":
      return <LoaderIcon />;
    case "overdue":
      return <CircleAlertIcon className="text-amber-600 dark:text-amber-500" />;
    case "trial":
      return <Clock3Icon className="text-muted-foreground" />;
    default:
      return null;
  }
}

function statusBadgeClassName(status: string | null) {
  switch (status) {
    case "active":
      return "border-green-500/35 bg-green-500/10 text-green-700 dark:text-green-300";
    case "scheduled":
      return "border-blue-500/35 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "expired":
    case "stopped":
      return "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300";
    case "frozen":
      return "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "inactive":
      return "border-slate-500/35 bg-slate-500/10 text-slate-600 dark:text-slate-300";
    default:
      return "border-muted-foreground/25 bg-muted/30 text-muted-foreground";
  }
}

function billingBadgeClassName(billing: string) {
  switch (billing) {
    case "paid":
      return "border-green-500/35 bg-green-500/10 text-green-700 dark:text-green-300";
    case "overdue":
      return "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300";
    case "pending":
      return "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "trial":
      return "border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    default:
      return "border-muted-foreground/25 bg-muted/30 text-muted-foreground";
  }
}

function getSessionTimingStatus(subscription: RecentCustomerRow["latest_subscription"]) {
  const health = subscription?.renewal_health;

  if (health === "sessions_exhausted" || health === "period_ended_sessions_left") {
    return health;
  }

  return subscription?.sessions_total == null ? "not_applicable" : "on_track";
}

function sessionTimingBadgeClassName(status: string) {
  if (status === "on_track") {
    return "border-green-500/35 bg-green-500/10 text-green-700 dark:text-green-300";
  }

  if (status === "not_applicable") {
    return "border-muted-foreground/25 bg-muted/30 text-muted-foreground";
  }

  return "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300";
}

export function createRecentCustomersColumns({
  labels,
  locale,
  renderActions,
}: {
  labels: RecentCustomersColumnLabels;
  locale: string;
  renderActions: (row: RecentCustomerRow) => React.ReactNode;
}): ColumnDef<RecentCustomerRow>[] {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const compactDateFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label={labels.selectAll}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={labels.selectMember({ name: row.original.name })}
          />
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: labels.member,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md border bg-muted">
            <UserRound className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-end justify-between gap-3">
              <div className="grid min-w-0 gap-0.5">
                <span className="truncate font-medium text-sm leading-none">{row.original.name}</span>
                <span className="truncate text-muted-foreground text-xs leading-none">
                  {row.original.phone || row.original.email || labels.contactMissing}
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "search",
      accessorFn: (row) => `${row.id} ${row.name} ${row.email} ${row.phone}`,
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      accessorKey: "status",
      header: labels.status,
      filterFn: "equalsString",
      cell: ({ row }) => (
        <div className="grid gap-1">
          <Badge variant="outline" className={cn("w-fit px-1.5", statusBadgeClassName(row.original.status))}>
            {labels.statuses[row.original.status ?? "none"] ?? row.original.status}
          </Badge>
          {row.original.latest_subscription?.pending_freeze ? (
            <span className="text-amber-700 text-xs dark:text-amber-300">{labels.freezeApprovalPending}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "sessionTiming",
      header: labels.sessionTiming,
      cell: ({ row }) => {
        const subscription = row.original.latest_subscription;
        const timingStatus = getSessionTimingStatus(subscription);
        const detailCount =
          timingStatus === "sessions_exhausted"
            ? (subscription?.days_left ?? 0)
            : (subscription?.sessions_remaining ?? 0);
        const detail = labels.sessionTimingDetails[timingStatus]?.(detailCount);

        return (
          <div className="grid max-w-48 gap-1">
            <Badge variant="outline" className={cn("w-fit px-1.5", sessionTimingBadgeClassName(timingStatus))}>
              {labels.sessionTimingStatuses[timingStatus] ?? timingStatus}
            </Badge>
            {detail ? <span className="text-muted-foreground text-xs">{detail}</span> : null}
          </div>
        );
      },
    },
    {
      accessorKey: "billing",
      header: labels.billing,
      filterFn: "equalsString",
      cell: ({ row }) => (
        <div className="grid gap-1">
          <Badge variant="outline" className={cn("w-fit px-1.5", billingBadgeClassName(row.original.billing))}>
            {billingIcon(row.original.billing)}
            {labels.billingStatuses[row.original.billing] ?? row.original.billing}
          </Badge>
          <span className="text-muted-foreground text-xs">{labels.paidAmount({ amount: row.original.totalPaid })}</span>
        </div>
      ),
    },
    {
      accessorKey: "plan",
      header: labels.plan,
      cell: ({ row }) => {
        const subscription = row.original.latest_subscription;
        const mainPlanPaid = subscription?.paid_total ?? subscription?.price_paid;
        const activeAddons =
          subscription?.addons?.filter((addon) => addon.status !== "stopped" && addon.status !== "cancelled") ?? [];

        return (
          <div className="grid max-w-72 gap-0.5">
            <span className="truncate text-sm">{row.original.plan ?? labels.noPlan}</span>
            {mainPlanPaid ? <span className="text-muted-foreground text-xs">Paid: {mainPlanPaid} EGP</span> : null}
            {activeAddons.map((addon) => (
              <span key={addon.id} className="truncate text-muted-foreground text-xs">
                + {addon.plan?.name ?? "Extra"}: {addon.paid_total ?? addon.price_paid ?? "0.00"} EGP
              </span>
            ))}
            {row.original.planStartsAt ? (
              <span className="text-muted-foreground text-xs">
                {labels.startsAt({ date: compactDateFormatter.format(parseISO(row.original.planStartsAt)) })}
              </span>
            ) : null}
            {row.original.planEndsAt ? (
              <span className="text-muted-foreground text-xs">
                {labels.endsAt({ date: compactDateFormatter.format(parseISO(row.original.planEndsAt)) })}
              </span>
            ) : null}
            {row.original.status === "frozen" ? (
              <span className="text-amber-700 text-xs dark:text-amber-300">
                {labels.pausedDaysRemaining({ count: subscription?.days_left ?? 0 })}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "joinedWindow",
      accessorFn: (row) => {
        if (!row.joined) {
          return [];
        }

        const daysSinceJoined = differenceInCalendarDays(endOfToday(), parseISO(row.joined));

        if (daysSinceJoined <= 30) return ["30", "90"];
        if (daysSinceJoined <= 90) return ["90"];
        return [];
      },
      filterFn: "arrIncludes",
      enableHiding: true,
    },
    {
      accessorKey: "joined",
      header: labels.joined,
      cell: ({ row }) => {
        if (!row.original.joined) {
          return <span className="text-muted-foreground text-sm">{labels.dateMissing}</span>;
        }

        const joinedAt = parseISO(row.original.joined);

        return (
          <div className="grid gap-0.5">
            <span className="text-sm">{dateFormatter.format(joinedAt)}</span>
            <span className="text-muted-foreground text-xs">#{row.original.id}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">{labels.actions}</div>,
      cell: ({ row }) => <div className="flex justify-end">{renderActions(row.original)}</div>,
      enableHiding: false,
    },
  ];
}
