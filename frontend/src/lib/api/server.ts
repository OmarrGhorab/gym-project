import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

type ApiEnvelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
  message?: string;
};

export async function serverApiFetch<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Missing authentication token.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? payload.message ?? response.statusText);
  }

  return payload;
}
