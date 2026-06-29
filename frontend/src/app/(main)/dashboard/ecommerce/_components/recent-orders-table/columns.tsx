import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { MoreHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { formatEgp } from "../format";
import type { OrderRow } from "./schema";

function formatOrderDate(date: string | null) {
  if (!date) {
    return "No date";
  }

  return format(parseISO(date), "h:mm a, d MMM yyyy");
}

function PaymentBadge({ status }: { status: OrderRow["payment"] }) {
  if (status === "Paid") {
    return (
      <Badge
        className="border-green-700/25 text-green-700 dark:border-green-300/25 dark:text-green-300"
        variant="outline"
      >
        <span className="size-1.5 rounded-full bg-current" />
        Paid
      </Badge>
    );
  }

  return (
    <Badge
      className="border-yellow-700/25 text-yellow-700 dark:border-yellow-300/25 dark:text-yellow-300"
      variant="outline"
    >
      <span className="size-1.5 rounded-full bg-current" />
      Pending
    </Badge>
  );
}

function SaleStatusBadge({ status }: { status: string }) {
  const isCompleted = status.toLowerCase() === "completed";

  return (
    <Badge variant={isCompleted ? "outline" : "destructive"}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  );
}

export const recentOrdersColumns: ColumnDef<OrderRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="w-10">
        <Checkbox
          aria-label="Select all POS orders"
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="w-10">
        <Checkbox
          aria-label={`Select POS order ${row.original.id}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      </div>
    ),
    enableHiding: false,
    enableSorting: false,
  },
  {
    accessorKey: "id",
    header: "Sale",
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <div className="font-medium leading-none">{row.original.id}</div>
        <div className="text-muted-foreground text-xs">{row.original.items}</div>
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "customer",
    header: "Member",
  },
  {
    accessorKey: "seller",
    header: "Seller",
  },
  {
    id: "statusSummary",
    header: "Status",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <PaymentBadge status={row.original.payment} />
        <SaleStatusBadge status={row.original.status} />
      </div>
    ),
    filterFn: (row, _columnId, value) => {
      if (value === "Paid") {
        return row.original.payment === "Paid";
      }

      if (value === "Pending") {
        return row.original.payment === "Pending";
      }

      if (value === "Completed") {
        return row.original.status.toLowerCase() === "completed";
      }

      if (value === "Voided") {
        return row.original.status.toLowerCase() === "voided";
      }

      return true;
    },
  },
  {
    accessorKey: "payment_method",
    header: () => <div className="w-28">Method</div>,
    cell: ({ row }) => (
      <div className="w-28 text-muted-foreground capitalize">{row.original.payment_method.replaceAll("_", " ")}</div>
    ),
  },
  {
    accessorKey: "total",
    header: () => <div className="w-28">Total</div>,
    cell: ({ row }) => <div className="w-28 tabular-nums">{formatEgp(row.original.total)}</div>,
  },
  {
    accessorKey: "date",
    header: () => <div className="w-44">Date</div>,
    cell: ({ row }) => <div className="w-44 text-muted-foreground">{formatOrderDate(row.original.date)}</div>,
  },
  {
    id: "actions",
    header: () => <div className="flex w-full justify-end">Actions</div>,
    cell: () => (
      <div className="flex w-full justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button aria-label="Open POS sale actions" size="icon-sm" variant="ghost" />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>Sale Actions</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem>View sale</DropdownMenuItem>
              <DropdownMenuItem>Download receipt</DropdownMenuItem>
              <DropdownMenuItem>Copy sale ID</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    enableHiding: false,
    enableSorting: false,
  },
];
