"use client";
"use no memo";

import type { ColumnDef } from "@tanstack/react-table";
import { addMinutes, differenceInCalendarDays, endOfToday, parseISO } from "date-fns";
import { CircleAlertIcon, CircleCheckIcon, Clock3Icon, LoaderIcon, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import type { RecentCustomerRow } from "./schema";

type RecentCustomersColumnLabels = {
  atTime: (values: { time: string }) => string;
  billing: string;
  billingStatuses: Record<string, string>;
  joined: string;
  member: string;
  plan: string;
  selectAll: string;
  selectMember: (values: { name: string }) => string;
  status: string;
  statuses: Record<string, string>;
};

function billingIcon(billing: string) {
  switch (billing) {
    case "Paid":
      return <CircleCheckIcon className="fill-green-500 stroke-primary-foreground dark:fill-green-600" />;
    case "Pending":
      return <LoaderIcon />;
    case "Overdue":
      return <CircleAlertIcon className="text-amber-600 dark:text-amber-500" />;
    case "Trial":
      return <Clock3Icon className="text-muted-foreground" />;
    default:
      return null;
  }
}

export function createRecentCustomersColumns({
  labels,
  locale,
}: {
  labels: RecentCustomersColumnLabels;
  locale: string;
}): ColumnDef<RecentCustomerRow>[] {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
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
                <span className="truncate text-muted-foreground text-xs leading-none">#{row.original.id}</span>
              </div>
            </div>
          </div>
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "search",
      accessorFn: (row) => `${row.id} ${row.name} ${row.email}`,
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      accessorKey: "status",
      header: labels.status,
      filterFn: "equalsString",
      cell: ({ row }) => (
        <Badge variant="outline" className="px-1.5 text-muted-foreground">
          {labels.statuses[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "billing",
      header: labels.billing,
      filterFn: "equalsString",
      cell: ({ row }) => (
        <Badge variant="outline" className="px-1.5 text-muted-foreground">
          {billingIcon(row.original.billing)}
          {labels.billingStatuses[row.original.billing] ?? row.original.billing}
        </Badge>
      ),
    },
    {
      accessorKey: "plan",
      header: labels.plan,
      cell: ({ row }) => <span className="text-sm">{row.original.plan}</span>,
    },
    {
      id: "joinedWindow",
      accessorFn: (row) => {
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
        const baseDate = parseISO(row.original.joined);
        const joinedAt = addMinutes(baseDate, 9 * 60 + (Number(row.original.id) % 12) * 17);

        return (
          <div className="grid gap-0.5">
            <span className="text-sm">{dateFormatter.format(joinedAt)}</span>
            <span className="text-muted-foreground text-xs">
              {labels.atTime({ time: timeFormatter.format(joinedAt) })}
            </span>
          </div>
        );
      },
    },
  ];
}
