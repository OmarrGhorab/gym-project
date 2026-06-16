import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_MAX_AGE, AUTH_TOKEN_COOKIE } from "@/lib/auth-cookie";

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000/api/v1";

type AuthApiPayload = {
  data?: {
    token?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function getCookieOptions(remember?: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: AUTH_COOKIE_MAX_AGE } : {}),
  };
}

function stripToken(payload: AuthApiPayload): AuthApiPayload {
  if (!payload.data || !("token" in payload.data)) return payload;

  const data = { ...payload.data };
  delete data.token;

  return {
    ...payload,
    data,
  };
}

async function readJsonBody(request: Request) {
  const text = await request.text();

  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function forwardAuthRequest(
  path: string,
  request: Request,
  init: { method?: "GET" | "POST"; storeToken?: boolean } = {}
) {
  const method = init.method ?? "POST";
  const body = method === "POST" ? await readJsonBody(request) : undefined;
  const url =
    method === "GET"
      ? `${API_BASE_URL}${path}${new URL(request.url).search}`
      : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as AuthApiPayload;

  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }

  if (init.storeToken && payload.data?.token) {
    const cookieStore = await cookies();
    cookieStore.set(
      AUTH_TOKEN_COOKIE,
      payload.data.token,
      getCookieOptions(Boolean(body?.remember))
    );
  }

  return NextResponse.json(stripToken(payload), { status: response.status });
}
