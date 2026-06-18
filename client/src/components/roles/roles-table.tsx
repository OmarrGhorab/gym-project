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
import type { AppLocale } from "@/i18n/routing";
import { deleteRole } from "@/lib/actions/roles";
import type { Role } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type RolesTableProps = {
  roles: Role[];
  onEdit: (role: Role) => void;
};

export function RolesTable({ roles, onEdit }: RolesTableProps) {
  const locale = useLocale();
  const t = useTranslations("RolesPage");
  const isArabic = locale === "ar";

  const columns = React.useMemo<ColumnDef<Role>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("tableRole"),
        cell: ({ row }) => {
          const role = row.original;

          return (
            <div className={cn("min-w-44", isArabic && "text-right")}>
              <p className="text-sm font-black text-foreground">{role.name}</p>
              <p className="text-xs font-semibold text-muted-foreground">
                {role.is_preset ? t("presetHint") : t("customHint")}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "is_preset",
        header: t("tableType"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs font-bold",
              row.original.is_preset
                ? "border-sky-500/20 bg-sky-500/15 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                : "border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
            )}
          >
            {row.original.is_preset ? t("typePreset") : t("typeCustom")}
          </Badge>
        ),
      },
      {
        accessorKey: "permissions",
        header: t("tablePermissions"),
        cell: ({ row }) => (
          <div className="flex max-w-lg flex-wrap gap-1.5">
            {row.original.permissions.slice(0, 5).map((permission) => (
              <Badge
                key={permission}
                variant="outline"
                className="rounded-md bg-muted/40 px-2 py-0.5 text-xs font-semibold text-muted-foreground"
              >
                {formatPermission(permission)}
              </Badge>
            ))}
            {row.original.permissions.length > 5 && (
              <Badge
                variant="outline"
                className="rounded-md px-2 py-0.5 text-xs font-bold text-foreground"
              >
                {t("morePermissions", {
                  count: row.original.permissions.length - 5,
                })}
              </Badge>
            )}
            {row.original.permissions.length === 0 && (
              <span className="text-xs font-semibold text-muted-foreground">
                {t("noPermissions")}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "permissions_count",
        header: t("tablePermissionCount"),
        cell: ({ row }) => (
          <span className="text-sm font-black text-foreground tabular-nums">
            {row.original.permissions.length.toLocaleString(
              isArabic ? "ar-EG" : "en-US"
            )}
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
        cell: ({ row }) => <RoleActions role={row.original} onEdit={onEdit} />,
      },
    ],
    [isArabic, onEdit, t]
  );

  return (
    <DataTable
      columns={columns}
      data={roles}
      emptyMessage={t("empty")}
      isArabic={isArabic}
    />
  );
}

function RoleActions({
  role,
  onEdit,
}: {
  role: Role;
  onEdit: (role: Role) => void;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("RolesPage");
  const [isPending, setIsPending] = React.useState(false);

  async function handleDelete() {
    if (role.is_preset) return;

    const confirmed = window.confirm(t("deleteConfirm", { name: role.name }));
    if (!confirmed) return;

    setIsPending(true);
    try {
      await deleteRole(role.id, locale as AppLocale);
      toast.success(t("roleDeletedSuccess"));
      router.refresh();
    } catch (err) {
      const parsed = parseActionError(err);
      toast.error(parsed?.message ?? (err instanceof Error ? err.message : t("formError")));
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
        title={role.is_preset ? t("actionEditPreset") : t("actionEdit")}
        onClick={() => onEdit(role)}
        disabled={role.is_preset}
      >
        <Edit3 className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title={role.is_preset ? t("actionDeletePreset") : t("actionDelete")}
        onClick={handleDelete}
        disabled={role.is_preset || isPending}
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </Button>
    </div>
  );
}

function formatPermission(permission: string) {
  return permission
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" ");
}

function parseActionError(
  err: unknown
): { message: string; details?: Record<string, string[]> } | null {
  if (!(err instanceof Error)) return null;

  try {
    const parsed = JSON.parse(err.message) as {
      message?: string;
      details?: Record<string, string[]>;
    };
    return parsed.message
      ? { message: parsed.message, details: parsed.details }
      : null;
  } catch {
    return null;
  }
}
