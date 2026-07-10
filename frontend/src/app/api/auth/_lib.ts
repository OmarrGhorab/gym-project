import "server-only";

import { NextResponse } from "next/server";

import { z } from "zod";

import { AUTH_COOKIE_MAX_AGE, AUTH_TOKEN_COOKIE } from "@/lib/auth-cookie";

export const API_BASE_URL = getRequiredEnv("API_BASE_URL");

const FRONTEND_URL = getOptionalEnv("FRONTEND_URL");
const AUTH_PROXY_TIMEOUT_MS = 15_000;

type AuthApiPayload = {
  data?: {
    token?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const emailSchema = z.email().max(254);
const passwordSchema = z.string().min(1).max(256);
const otpSchema = z.string().regex(/^\d{6}$/);

const authRequestSchemas = {
  "/auth/forgot-password": z.object({ email: emailSchema }).strict(),
  "/auth/login": z.object({ email: emailSchema, password: passwordSchema, remember: z.boolean().optional() }).strict(),
  "/auth/register": z
    .object({
      email: emailSchema,
      name: z.string().trim().min(1).max(120),
      password: passwordSchema,
      password_confirmation: passwordSchema,
    })
    .strict(),
  "/auth/resend-verification": z.object({ email: emailSchema }).strict(),
  "/auth/reset-password": z
    .object({
      email: emailSchema,
      password: passwordSchema,
      password_confirmation: passwordSchema,
      token: z.string().min(1).max(2048),
    })
    .strict(),
  "/auth/verify-email": z.object({ email: emailSchema, otp: otpSchema }).strict(),
  "/auth/verify-otp": z.object({ email: emailSchema, otp: otpSchema }).strict(),
} as const;

export function getCookieOptions(remember?: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
    ...(remember ? { maxAge: AUTH_COOKIE_MAX_AGE } : {}),
  };
}

function stripToken(payload: AuthApiPayload): AuthApiPayload {
  if (!payload.data || !("token" in payload.data)) {
    return payload;
  }

  const data = { ...payload.data };
  delete data.token;

  return {
    ...payload,
    data,
  };
}

async function readJsonBody(request: Request, schema: z.ZodType) {
  const text = await request.text();

  if (!text) {
    return { success: false as const };
  }

  try {
    const parsed = schema.safeParse(JSON.parse(text));

    return parsed.success ? { data: parsed.data, success: true as const } : { success: false as const };
  } catch {
    return { success: false as const };
  }
}

export async function forwardAuthRequest(
  path: string,
  request: Request,
  init: {
    method?: "GET" | "POST";
    storeToken?: boolean;
    successRedirect?: string;
    failureRedirect?: string;
  } = {},
) {
  const method = init.method ?? "POST";
  const schema = authRequestSchemas[path as keyof typeof authRequestSchemas];
  const parsedBody = method === "POST" && schema ? await readJsonBody(request, schema) : undefined;

  if (parsedBody && !parsedBody.success) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: "Invalid request.",
        },
      },
      { status: 422 },
    );
  }

  const body = parsedBody?.success ? parsedBody.data : undefined;
  const url = method === "GET" ? `${API_BASE_URL}${path}${new URL(request.url).search}` : `${API_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_PROXY_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    const message = isTimeout
      ? "Authentication took too long. Please try again."
      : "Authentication service is unavailable. Please try again.";

    if (init.failureRedirect) {
      return redirectWithError(init.failureRedirect, request, message);
    }

    return NextResponse.json(
      {
        error: {
          code: isTimeout ? "auth_backend_timeout" : "auth_backend_unavailable",
          message,
        },
      },
      { status: isTimeout ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const payload = (await response.json().catch(() => ({}))) as AuthApiPayload;

  if (!response.ok) {
    if (init.failureRedirect) {
      return redirectWithError(init.failureRedirect, request, getPayloadMessage(payload) ?? response.statusText);
    }

    return NextResponse.json(payload, { status: response.status });
  }

  const authResponse = init.successRedirect
    ? NextResponse.redirect(buildRedirectUrl(init.successRedirect, request))
    : NextResponse.json(stripToken(payload), { status: response.status });

  if (init.storeToken && payload.data?.token) {
    const remember = typeof body === "object" && body !== null && "remember" in body && body.remember === true;

    authResponse.cookies.set(AUTH_TOKEN_COOKIE, payload.data.token, getCookieOptions(remember));
  }

  return authResponse;
}

function getPayloadMessage(payload: AuthApiPayload): string | undefined {
  const error = payload.error;

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }

  return typeof payload.message === "string" ? payload.message : undefined;
}

function redirectWithError(destination: string, request: Request, message: string) {
  const url = buildRedirectUrl(destination, request);
  url.searchParams.set("auth_error", message);

  return NextResponse.redirect(url);
}

function buildRedirectUrl(destination: string, request: Request) {
  return new URL(destination, FRONTEND_URL ?? request.url);
}

export function buildApiUrl(path: string, search = "") {
  return `${API_BASE_URL}${path}${search}`;
}

function getRequiredEnv(key: string) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value.replace(/\/$/, "");
}

function getOptionalEnv(key: string) {
  const value = process.env[key]?.trim();

  return value ? value.replace(/\/$/, "") : undefined;
}
