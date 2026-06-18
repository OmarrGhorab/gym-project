"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { RoleFormDialog } from "@/components/roles/role-form-dialog";
import { RolesTable } from "@/components/roles/roles-table";
import type { PermissionCatalog, Role } from "@/lib/api/dashboard";

type RolesTableContainerProps = {
  roles: Role[];
  permissions: PermissionCatalog;
};

export function RolesTableContainer({
  roles,
  permissions,
}: RolesTableContainerProps) {
  const router = useRouter();
  const t = useTranslations("RolesPage");
  const [dialogMode, setDialogMode] = React.useState<"add" | "edit">("add");
  const [selectedRole, setSelectedRole] = React.useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  function openAddDialog() {
    setDialogMode("add");
    setSelectedRole(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(role: Role) {
    setDialogMode("edit");
    setSelectedRole(role);
    setIsDialogOpen(true);
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

      <RolesTable roles={roles} onEdit={openEditDialog} />

      <RoleFormDialog
        mode={dialogMode}
        role={selectedRole}
        permissions={permissions}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}
