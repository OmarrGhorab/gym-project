"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppLocale } from "@/i18n/routing";
import { syncUserRoles } from "@/lib/actions/roles";
import type { Employee, Role } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type EmployeeRoleDialogProps = {
  employee: Employee | null;
  roles: Role[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EmployeeRoleDialog({
  employee,
  roles,
  open,
  onOpenChange,
  onSuccess,
}: EmployeeRoleDialogProps) {
  const dialogKey = `${employee?.id ?? "none"}-${open ? "open" : "closed"}`;

  return (
    <EmployeeRoleDialogContent
      key={dialogKey}
      employee={employee}
      roles={roles}
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />
  );
}

function EmployeeRoleDialogContent({
  employee,
  roles,
  open,
  onOpenChange,
  onSuccess,
}: EmployeeRoleDialogProps) {
  const locale = useLocale();
  const t = useTranslations("TeamsPage");
  const isArabic = locale === "ar";
  const [selectedRoles, setSelectedRoles] = React.useState<string[]>(() => employee?.user?.roles ?? []);
  const [isPending, setIsPending] = React.useState(false);

  function toggleRole(roleName: string, checked: boolean) {
    setSelectedRoles((current) =>
      checked
        ? Array.from(new Set([...current, roleName]))
        : current.filter((role) => role !== roleName)
    );
  }

  async function handleSubmit() {
    if (!employee?.user_id) {
      toast.error(t("roleAssignmentRequiresUser"));
      return;
    }

    setIsPending(true);
    try {
      await syncUserRoles(employee.user_id, { roles: selectedRoles }, locale as AppLocale);
      toast.success(t("roleAssignmentSuccess"));
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-lg", isArabic && "rtl")}>
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>{t("assignRolesTitle")}</DialogTitle>
          <DialogDescription>
            {employee?.user_id
              ? t("assignRolesDescription", { name: employee.name })
              : t("roleAssignmentRequiresUser")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-3">
          {roles.map((role) => (
            <label
              key={role.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm font-semibold hover:bg-muted/40",
                isArabic && "flex-row-reverse text-right"
              )}
            >
              <Checkbox
                checked={selectedRoles.includes(role.name)}
                onCheckedChange={(checked) => toggleRole(role.name, checked === true)}
                disabled={isPending || !employee?.user_id}
              />
              <span className="flex-1">{role.name}</span>
            </label>
          ))}
        </div>

        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("formCancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending || !employee?.user_id}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t("assignRolesSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
