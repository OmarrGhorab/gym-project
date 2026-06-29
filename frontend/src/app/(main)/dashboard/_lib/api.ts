export type PaginatedData<T> = {
  data: T[];
  meta?: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
  };
};

export function unwrapList<T>(payload: T[] | PaginatedData<T> | null | undefined): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload?.data ?? [];
}
