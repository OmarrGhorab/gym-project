import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type AccessUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
};

export type AccessRole = {
  id: number;
  name: string;
  is_preset: boolean;
  permissions: string[];
};

export async function getUsersPageData() {
  const [users, roles] = await Promise.all([
    safeFetch<AccessUser[] | PaginatedData<AccessUser>>("/users?sort=name&per_page=100", []),
    safeFetch<AccessRole[]>("/roles", []),
  ]);

  return {
    roles,
    users: unwrapList(users),
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
