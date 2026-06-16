export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, string[]>;
};

export type AuthResponse = {
  data: {
    user: {
      id: number;
      name: string;
      email: string;
      [key: string]: unknown;
    };
    token?: string;
  };
  message: string;
};

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
  });

  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    const error = (data.error ?? {}) as ApiError | Record<string, unknown>;
    const message =
      (error as ApiError).message ??
      (data.message as string) ??
      response.statusText;
    const code = (error as ApiError).code ?? `http_${response.status}`;
    const details = (error as ApiError).details;

    throw Object.assign(new Error(message), { code, details });
  }

  return data as T;
}

export async function login(payload: {
  email: string;
  password: string;
  remember?: boolean;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function register(payload: {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function forgotPassword(payload: {
  email: string;
}): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resetPassword(payload: {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getGoogleRedirectUrl(): string {
  return "/api/auth/google/redirect";
}

export async function googleCallback(
  searchParams: URLSearchParams
): Promise<AuthResponse> {
  const query = searchParams.toString();

  return apiFetch<AuthResponse>(`/api/auth/google/callback?${query}`, {
    method: "GET",
  });
}

export function getFieldErrors(
  error: unknown
): Record<string, string> | undefined {
  if (!error || typeof error !== "object") return undefined;

  const details = (error as { details?: Record<string, string[]> }).details;
  if (!details) return undefined;

  return Object.fromEntries(
    Object.entries(details).map(([key, messages]) => [
      key,
      Array.isArray(messages) ? messages[0] : messages,
    ])
  );
}

export function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  return (error as { code?: string }).code;
}

export function getFriendlyError(error: unknown): string {
  return getErrorMessage(error);
}
