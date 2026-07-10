import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_COOKIE_MAX_AGE } from "@/lib/auth-cookie";

vi.mock("server-only", () => ({}));

describe("auth cookie options", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("API_BASE_URL", "https://api.example.test");
  });

  it("persists a remembered session for 30 days", async () => {
    const { getCookieOptions } = await import("./_lib");

    expect(getCookieOptions(true)).toMatchObject({
      httpOnly: true,
      maxAge: AUTH_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    expect(AUTH_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 30);
  });

  it("creates a session cookie without a persistent lifetime when not remembered", async () => {
    const { getCookieOptions } = await import("./_lib");

    expect(getCookieOptions(false)).not.toHaveProperty("maxAge");
  });
});
