"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, MessageSquare, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import { priorities, statuses, type Task } from "./types";

const statusStyles: Record<string, string> = {
  doing: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  done: "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300",
  ideas: "border-muted-foreground/20 bg-muted text-muted-foreground",
  planned: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  review: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

function SortIcon({ sortDirection }: { sortDirection: false | "asc" | "desc" }) {
  if (sortDirection === "desc") return <ArrowDown data-icon="inline-end" />;
  if (sortDirection === "asc") return <ArrowUp data-icon="inline-end" />;

  return <ArrowUpDown data-icon="inline-end" />;
}

function TitleColumnHeader({ column }: { column: Column<Task, unknown> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground data-popup-open:bg-accent" />}
      >
        Task
        <SortIcon sortDirection={column.getIsSorted()} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => column.toggleSorting(false)}>
          <ArrowUp />
          Asc
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => column.toggleSorting(true)}>
          <ArrowDown />
          Desc
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => column.clearSorting()}>
          <RotateCcw />
          Reset
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function getColumns(onOpenTask: (task: Task) => void): ColumnDef<Task>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-0.5"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-0.5"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => <div className="w-24 font-mono text-muted-foreground text-sm">{row.original.id}</div>,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "title",
      header: ({ column }) => <TitleColumnHeader column={column} />,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <Badge className="rounded-sm bg-transparent" variant="outline">
            {row.original.sourceLabel}
          </Badge>
          <div className="min-w-0">
            <div className="max-w-xl truncate font-medium text-sm">{row.original.title}</div>
            <div className="max-w-xl truncate text-muted-foreground text-xs">{row.original.description}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "owner.name",
      id: "owner",
      header: "Assigned to",
      cell: ({ row }) => <span className="text-sm">{row.original.owner.name}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = statuses.find((status) => status.value === row.original.status);

        if (!status) return null;

        return (
          <Badge className={cn("gap-1.5 rounded-sm border font-medium", statusStyles[status.value])} variant="outline">
            <status.icon className="size-4" />
            {status.label}
          </Badge>
        );
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => {
        const priority = priorities.find((priority) => priority.value === row.original.priority);

        if (!priority) return null;

        return (
          <div className="flex items-center gap-2 text-sm">
            <priority.icon className="size-4 text-muted-foreground" />
            {priority.label}
          </div>
        );
      },
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: "progress",
      header: "Progress",
      cell: ({ row }) => (
        <div className="flex w-32 items-center gap-2">
          <Progress value={row.original.progress} />
          <span className="w-8 text-muted-foreground text-xs tabular-nums">{row.original.progress}%</span>
        </div>
      ),
    },
    {
      id: "comments",
      header: "Comments",
      cell: ({ row }) => {
        const count = row.original.insights.find((item) => item.label === "Comments")?.count ?? 0;

        return (
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <MessageSquare className="size-4" />
            {count}
          </div>
        );
      },
    },
    {
      accessorKey: "dueDate",
      header: "Due date",
      cell: ({ row }) => <span className="text-sm">{row.original.dueDate}</span>,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="text-right">
          <Button size="sm" variant="ghost" onClick={() => onOpenTask(row.original)}>
            Open
          </Button>
        </div>
      ),
    },
  ];
}
