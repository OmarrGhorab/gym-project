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

export async function getRolesPageData() {
  const [rolesResult, permissionsResult] = await Promise.all([
    serverApiFetch<RoleRow[]>("/roles"),
    serverApiFetch<Record<string, Array<string | { name: string; description?: string }>>>("/permissions"),
  ]);

  return {
    permissionGroups: normalizePermissionGroups(permissionsResult.data),
    roles: rolesResult.data,
  };
}

function normalizePermissionGroups(
  permissions: Record<string, Array<string | { name: string; description?: string }>>,
): PermissionGroup[] {
  return Object.entries(permissions).map(([group, rows]) => ({
    group,
    permissions: rows.map((row) => (typeof row === "string" ? { name: row } : row)),
  }));
}
