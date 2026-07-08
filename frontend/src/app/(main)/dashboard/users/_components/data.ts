import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type AccessUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  linked_employee: {
    id: number;
    name: string;
  } | null;
};

export type AccessRole = {
  id: number;
  name: string;
  is_preset: boolean;
  permissions: string[];
};

export async function getUsersPageData() {
  const [users, roles, employees] = await Promise.all([
    safeFetch<AccessUser[] | PaginatedData<AccessUser>>("/users?sort=name&per_page=100", []),
    safeFetch<AccessRole[]>("/roles", []),
    safeFetch<
      | Array<{ id: number; user_id: number | null; name: string }>
      | PaginatedData<{ id: number; user_id: number | null; name: string }>
    >("/employees?per_page=100", []),
  ]);

  const employeeByUserId = new Map(
    unwrapList(employees)
      .filter((employee) => typeof employee.user_id === "number" && employee.user_id > 0)
      .map((employee) => [employee.user_id as number, { id: employee.id, name: employee.name }]),
  );

  return {
    roles,
    users: unwrapList(users).map((user) => ({
      ...user,
      linked_employee: employeeByUserId.get(user.id) ?? null,
    })),
  };
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const result = await serverApiFetch<T>(path);

    return result.data;
  } catch {
    return fallback;
  }
}
