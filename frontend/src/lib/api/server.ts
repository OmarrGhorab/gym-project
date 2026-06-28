import { API_BASE_URL } from "@/app/api/auth/_lib";
import { getAuthToken } from "@/lib/session";

type ApiEnvelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
  message?: string;
};

type ApiErrorDetails = Record<string, string[] | string | undefined>;

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
    error?: { details?: ApiErrorDetails; message?: string };
  };

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(payload.error?.message ?? payload.message ?? response.statusText, payload.error?.details),
    );
  }

  return payload;
}

function getApiErrorMessage(message: string, details?: ApiErrorDetails) {
  const detailMessages = Object.values(details ?? {})
    .flatMap((detail) => {
      if (Array.isArray(detail)) {
        return detail;
      }

      return detail ? [detail] : [];
    })
    .filter(Boolean);

  return detailMessages[0] ?? message;
}
