"use client";

import * as React from "react";
import { Edit3, Loader2, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { MemberVisitDialog } from "@/components/attendance/member-visit-dialog";
import type { AppLocale } from "@/i18n/routing";
import { deleteMemberVisit } from "@/lib/actions/attendance";
import type { MemberVisit } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

export function MemberVisitsTable({ visits }: { visits: MemberVisit[] }) {
  const locale = useLocale();
  const t = useTranslations("AttendancePage");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const [selectedVisit, setSelectedVisit] = React.useState<MemberVisit | null>(null);
  const [isEditOpen, setIsEditOpen] = React.useState(false);

  const columns = React.useMemo<ColumnDef<MemberVisit>[]>(
    () => [
      {
        accessorKey: "member",
        header: t("memberVisitTableMember"),
        cell: ({ row }) => (
          <div className={cn(isArabic && "text-right")}>
            <p className="text-sm font-black text-foreground">
              {row.original.member?.name ?? `#${row.original.member_id}`}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {row.original.member?.phone ?? `#${row.original.member_id}`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "check_in_at",
        header: t("memberVisitTableCheckIn"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatDateTime(row.original.check_in_at, dateLocale)}
          </span>
        ),
      },
      {
        accessorKey: "check_out_at",
        header: t("memberVisitTableCheckOut"),
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {formatDateTime(row.original.check_out_at, dateLocale)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("memberVisitTableStatus"),
        cell: ({ row }) => (
          <Badge variant="outline" className={cn("rounded-md text-xs font-bold", statusClass(row.original.status))}>
            {memberVisitStatusLabel(row.original.status, t)}
          </Badge>
        ),
      },
      {
        accessorKey: "scan_method",
        header: t("memberVisitTableMethod"),
        cell: ({ row }) => (
          <Badge variant="outline" className="rounded-md text-xs font-bold">
            {scanMethodLabel(row.original.scan_method, t)}
          </Badge>
        ),
      },
      {
        accessorKey: "check_in_location",
        header: t("memberVisitTableLocation"),
        cell: ({ row }) => (
          <Badge variant="outline" className={cn("rounded-md text-xs font-bold", locationClass(row.original.check_in_location?.status))}>
            {locationStatusLabel(row.original.check_in_location?.status, t)}
          </Badge>
        ),
      },
      {
        accessorKey: "alert_reason",
        header: t("memberVisitTableAlert"),
        cell: ({ row }) => (
          <p className="line-clamp-2 min-w-48 text-xs font-semibold text-muted-foreground">
            {row.original.alert_reason ?? row.original.subscription?.plan_name ?? "-"}
          </p>
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
          <MemberVisitActions
            visit={row.original}
            onEdit={(visit) => {
              setSelectedVisit(visit);
              setIsEditOpen(true);
            }}
          />
        ),
      },
    ],
    [dateLocale, isArabic, t]
  );

  return (
    <>
      <DataTable columns={columns} data={visits} emptyMessage={t("memberVisitEmpty")} isArabic={isArabic} />
      <MemberVisitDialog
        mode="edit"
        visit={selectedVisit}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </>
  );
}

function MemberVisitActions({
  visit,
  onEdit,
}: {
  visit: MemberVisit;
  onEdit: (visit: MemberVisit) => void;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("AttendancePage");
  const [isPending, setIsPending] = React.useState(false);

  async function handleDelete() {
    const name = visit.member?.name ?? `#${visit.member_id}`;
    const confirmed = window.confirm(t("memberVisitDeleteConfirm", { name }));
    if (!confirmed) return;

    setIsPending(true);
    try {
      await deleteMemberVisit(visit.id, locale as AppLocale);
      toast.success(t("memberVisitDeletedSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button type="button" variant="ghost" size="icon-sm" title={t("actionEdit")} onClick={() => onEdit(visit)}>
        <Edit3 className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" title={t("actionDelete")} onClick={handleDelete} disabled={isPending}>
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </Button>
    </div>
  );
}

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function memberVisitStatusLabel(status: string, t: (key: string) => string) {
  if (status === "blocked") return t("memberVisitStatusBlocked");
  if (status === "flagged") return t("memberVisitStatusFlagged");
  return t("memberVisitStatusAllowed");
}

function statusClass(status: string) {
  if (status === "blocked") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "flagged") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

function scanMethodLabel(method: string | null | undefined, t: (key: string) => string) {
  switch (method) {
    case "qr":
      return t("scanMethodQr");
    case "phone":
      return t("scanMethodPhone");
    case "name":
      return t("scanMethodName");
    default:
      return t("scanMethodManual");
  }
}

function locationStatusLabel(status: string | null | undefined, t: (key: string) => string) {
  switch (status) {
    case "inside":
      return t("locationInside");
    case "outside":
      return t("locationOutside");
    case "unconfigured":
      return t("locationUnconfigured");
    default:
      return t("locationMissingShort");
  }
}

function locationClass(status: string | null | undefined) {
  switch (status) {
    case "inside":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "outside":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "border-slate-500/20 bg-slate-500/10 text-muted-foreground";
  }
}
