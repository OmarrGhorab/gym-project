import { cookies } from "next/headers";

import { API_BASE_URL } from "@/app/api/auth/_lib";
import { AUTH_TOKEN_COOKIE } from "@/lib/auth-cookie";

type NotificationRow = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string | null;
};

type NotificationsPayload = {
  data?: NotificationRow[] | { data?: NotificationRow[] };
  meta?: {
    total?: number;
  };
};

const STREAM_INTERVAL_MS = 5000;
const ENCODER = new TextEncoder();

export async function GET(request: Request) {
  const token = (await cookies()).get(AUTH_TOKEN_COOKIE)?.value;

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let lastPayload = "";
      const abort = new AbortController();

      request.signal.addEventListener("abort", () => abort.abort(), { once: true });

      const send = (event: string, data: unknown) => {
        controller.enqueue(ENCODER.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("connected", { ok: true });

      while (!abort.signal.aborted) {
        try {
          const payload = await fetchUnreadNotifications(token, abort.signal);
          const serialized = JSON.stringify(payload);

          if (serialized !== lastPayload) {
            lastPayload = serialized;
            send("notifications", payload);
          } else {
            controller.enqueue(ENCODER.encode(": heartbeat\n\n"));
          }
        } catch (error) {
          if (abort.signal.aborted) {
            break;
          }

          send("error", {
            message: error instanceof Error ? error.message : "Notification stream failed.",
          });
        }

        await sleep(STREAM_INTERVAL_MS, abort.signal);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}

async function fetchUnreadNotifications(token: string, signal: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/notifications?unread=1&page=1&per_page=15`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  const payload = (await response.json()) as NotificationsPayload;
  const notifications = unwrapNotifications(payload.data);

  return {
    notifications,
    unread: Number(payload.meta?.total ?? notifications.length),
  };
}

function unwrapNotifications(value: NotificationsPayload["data"]): NotificationRow[] {
  if (Array.isArray(value)) {
    return value;
  }

  return Array.isArray(value?.data) ? value.data : [];
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}
