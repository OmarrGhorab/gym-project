import "server-only";

import { z } from "zod";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { requireAuth } from "@/lib/session";

type ApiEnvelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
  message?: string;
};

type ApiErrorDetails = Record<string, string[] | string | undefined>;

const apiEnvelopeSchema = z.object({
  data: z.unknown(),
  message: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const apiErrorPayloadSchema = apiEnvelopeSchema.extend({
  error: z
    .object({
      details: z.record(z.string(), z.union([z.array(z.string()), z.string()])).optional(),
      message: z.string().optional(),
    })
    .optional(),
});

export async function serverApiFetch<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const token = await requireAuth();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
    cache: "no-store",
  });

  const rawPayload: unknown = await response.json().catch(() => ({}));
  const parsedPayload = apiErrorPayloadSchema.safeParse(rawPayload);

  if (!parsedPayload.success) {
    throw new Error("The API returned an invalid response.");
  }

  const payload = parsedPayload.data;

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(payload.error?.message ?? payload.message ?? response.statusText, payload.error?.details),
    );
  }

  return payload as ApiEnvelope<T>;
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
