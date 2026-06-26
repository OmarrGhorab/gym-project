"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmployeeFormDialog } from "@/components/teams/employee-form-dialog";
import { EmployeeRoleDialog } from "@/components/teams/employee-role-dialog";
import { TeamTable } from "@/components/teams/team-table";
import type { Employee, Role } from "@/lib/api/dashboard";

type TeamTableContainerProps = {
  employees: Employee[];
  roles?: Role[];
  namespace?: "TeamsPage" | "TrainersPage";
};

export function TeamTableContainer({
  employees,
  roles = [],
  namespace = "TeamsPage",
}: TeamTableContainerProps) {
  const router = useRouter();
  const t = useTranslations(namespace);
  const [dialogMode, setDialogMode] = React.useState<"add" | "edit">("add");
  const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = React.useState(false);

  function openAddDialog() {
    setDialogMode("add");
    setSelectedEmployee(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(employee: Employee) {
    setDialogMode("edit");
    setSelectedEmployee(employee);
    setIsDialogOpen(true);
  }

  function openRoleDialog(employee: Employee) {
    setSelectedEmployee(employee);
    setIsRoleDialogOpen(true);
  }

  function handleSuccess() {
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-end border-b px-4 py-3">
        <Button type="button" size="sm" onClick={openAddDialog}>
          <Plus className="size-4" />
          {t("addButton")}
        </Button>
      </div>

      <TeamTable
        employees={employees}
        namespace={namespace}
        onEdit={openEditDialog}
        onAssignRoles={openRoleDialog}
      />

      <EmployeeFormDialog
        mode={dialogMode}
        employee={selectedEmployee}
        namespace={namespace}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={handleSuccess}
      />

      <EmployeeRoleDialog
        employee={selectedEmployee}
        roles={roles}
        open={isRoleDialogOpen}
        onOpenChange={setIsRoleDialogOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}
