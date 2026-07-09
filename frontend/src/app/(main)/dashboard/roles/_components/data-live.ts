import { serverApiFetch } from "@/lib/api/server";

export type RoleRow = {
  id: number;
  name: string;
  is_preset: boolean;
  users_count: number;
  permissions: string[];
};

export type PermissionGroup = {
  group: string;
  permissions: Array<{
    name: string;
    description?: string;
  }>;
};

const hiddenPermissionGroups = new Set(["foundation"]);
const hiddenPermissions = new Set(["foundation.access-sample"]);

export async function getRolesPageData() {
  const [rolesResult, permissionsResult] = await Promise.all([
    serverApiFetch<RoleRow[]>("/roles"),
    serverApiFetch<Record<string, Array<string | { name: string; description?: string }>>>("/permissions"),
  ]);

  return {
    permissionGroups: normalizePermissionGroups(permissionsResult.data),
    roles: rolesResult.data.map((role) => ({
      ...role,
      permissions: role.permissions.filter((permission) => !hiddenPermissions.has(permission)),
    })),
  };
}

function normalizePermissionGroups(
  permissions: Record<string, Array<string | { name: string; description?: string }>>,
): PermissionGroup[] {
  return Object.entries(permissions)
    .filter(([group]) => !hiddenPermissionGroups.has(group))
    .map(([group, rows]) => ({
      group,
      permissions: rows
        .map((row) => (typeof row === "string" ? { name: row } : row))
        .filter((permission) => !hiddenPermissions.has(permission.name)),
    }))
    .filter((group) => group.permissions.length > 0);
}
