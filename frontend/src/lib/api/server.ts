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

export class ServerApiError extends Error {
  details?: ApiErrorDetails;

  constructor(message: string, details?: ApiErrorDetails) {
    super(message);
    this.name = "ServerApiError";
    this.details = details;
  }
}

/**
 * Backend success: { data, message?, meta? }
 * Backend errors:  { error: { code, message, details } }  (no data key)
 * Also accept Laravel-style: { message, errors }
 */
const apiPayloadSchema = z
  .object({
    data: z.unknown().optional(),
    message: z.string().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    error: z
      .object({
        code: z.string().optional(),
        // Object map, empty object, or rarely an array — keep loose so we never mask the real message.
        details: z.unknown().optional(),
        message: z.string().optional(),
      })
      .optional(),
    // Laravel default validation shape (if any route skips our exception map)
    errors: z.unknown().optional(),
  })
  .passthrough();

export async function serverApiFetch<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const token = await requireAuth();

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(
      error instanceof Error ? `Could not reach the API (${error.message}).` : "Could not reach the API.",
    );
  }

  const rawText = await response.text();
  let rawPayload: unknown = {};

  if (rawText.trim()) {
    try {
      rawPayload = JSON.parse(rawText);
    } catch {
      throw new Error(
        response.ok
          ? "The API returned a non-JSON response."
          : `API error ${response.status}: ${rawText.slice(0, 180).trim() || response.statusText}`,
      );
    }
  }

  const parsedPayload = apiPayloadSchema.safeParse(rawPayload);

  if (!parsedPayload.success) {
    throw new Error(
      response.ok
        ? "The API returned an invalid response."
        : getApiErrorMessage(
            typeof rawPayload === "object" && rawPayload && "message" in rawPayload
              ? String((rawPayload as { message?: unknown }).message ?? response.statusText)
              : `API error ${response.status}`,
            typeof rawPayload === "object" && rawPayload && "errors" in rawPayload
              ? ((rawPayload as { errors?: ApiErrorDetails }).errors ?? undefined)
              : undefined,
          ),
    );
  }

  const payload = parsedPayload.data;

  if (!response.ok) {
    const details = normalizeErrorDetails(payload.error?.details ?? payload.errors);
    throw new ServerApiError(
      getApiErrorMessage(payload.error?.message ?? payload.message ?? response.statusText, details),
      details,
    );
  }

  return {
    data: payload.data as T,
    message: payload.message,
    meta: payload.meta,
  };
}

function normalizeErrorDetails(details: unknown): ApiErrorDetails | undefined {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return undefined;
  }

  return details as ApiErrorDetails;
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
