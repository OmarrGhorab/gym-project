"use client";

import * as React from "react";

import { Loader2, MessageCircle, RefreshCw, Unlink } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ConnectionState =
  | "connected"
  | "qr_pending"
  | "disconnected"
  | "logged_out"
  | "conflict"
  | "not_configured"
  | "unreachable";

type Connection = {
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  error: string | null;
  number: string | null;
  queued: number;
  state: ConnectionState | string;
};

const STATUS: Record<string, { label: string; tone: string; help: string }> = {
  connected: {
    label: "Connected",
    tone: "text-emerald-600 dark:text-emerald-400",
    help: "Messages are being sent from this number.",
  },
  qr_pending: {
    label: "Waiting for scan",
    tone: "text-amber-600 dark:text-amber-400",
    help: "Scan the code below with the gym's phone to link it.",
  },
  disconnected: {
    label: "Reconnecting",
    tone: "text-amber-600 dark:text-amber-400",
    help: "The service lost its connection and is retrying on its own.",
  },
  logged_out: {
    label: "Not linked",
    tone: "text-destructive",
    help: "The number was unlinked. A new code appears here within a few seconds — scan it with the gym's phone to connect again.",
  },
  conflict: {
    label: "Taken over",
    tone: "text-destructive",
    help: "Another copy of the WhatsApp service linked as this device and took the session. Stop the duplicate on the server, then press Reconnect — the number is still linked, so no one needs to scan anything.",
  },
  not_configured: {
    label: "Not set up",
    tone: "text-muted-foreground",
    help: "WHATSAPP_SERVICE_URL and WHATSAPP_SERVICE_TOKEN are missing from the server's .env.",
  },
  unreachable: {
    label: "Service down",
    tone: "text-destructive",
    help: "The WhatsApp service is not responding. Check `pm2 logs gym-whatsapp` on the server.",
  },
};

/**
 * Links the gym's WhatsApp number and shows whether it is still linked.
 *
 * Polls rather than renders once: WhatsApp rotates the pairing code every ~20
 * seconds, so a static QR is unscannable by the time anyone picks up a phone.
 */
export function WhatsAppConnectionCard() {
  const [connection, setConnection] = React.useState<Connection | null>(null);
  const [qr, setQr] = React.useState<string | null>(null);
  const [unlinking, setUnlinking] = React.useState(false);
  const [reconnecting, setReconnecting] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      const response = await fetch("/api/whatsapp/connection", { cache: "no-store" });
      const payload = (await response.json()) as { data?: Connection };
      const next = payload.data ?? null;
      setConnection(next);

      // Only the pairing state has a code worth fetching, and fetching it while
      // connected would be a pointless request every few seconds.
      if (next?.state === "qr_pending") {
        const qrResponse = await fetch("/api/whatsapp/qr", { cache: "no-store" });
        const qrPayload = (await qrResponse.json()) as { data?: { qr: string | null } };
        setQr(qrPayload.data?.qr ?? null);
      } else {
        setQr(null);
      }
    } catch {
      setConnection(null);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);

    return () => clearInterval(timer);
  }, [refresh]);

  const unlink = async () => {
    setUnlinking(true);
    try {
      await fetch("/api/whatsapp/logout", { method: "POST" });
      await refresh();
    } finally {
      setUnlinking(false);
    }
  };

  const reconnect = async () => {
    setReconnecting(true);
    try {
      await fetch("/api/whatsapp/reconnect", { method: "POST" });
      await refresh();
    } finally {
      setReconnecting(false);
    }
  };

  const status = STATUS[connection?.state ?? ""] ?? {
    label: "Checking…",
    tone: "text-muted-foreground",
    help: "Reading the connection status.",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-normal">
          <MessageCircle className="size-4" /> WhatsApp connection
        </CardTitle>
        <CardDescription>
          Link the gym's WhatsApp number once, from the gym's phone: WhatsApp → Settings → Linked devices → Link a
          device. Messages then send on their own, with no one pressing send.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className={status.tone}>
            {status.label}
          </Badge>
          {connection?.number ? <span className="font-mono text-sm">+{connection.number}</span> : null}
          {connection && connection.queued > 0 ? (
            <span className="text-muted-foreground text-xs">{connection.queued} message(s) waiting to send</span>
          ) : null}
          <Button type="button" size="sm" variant="ghost" className="ms-auto gap-1.5" onClick={() => void refresh()}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">{status.help}</p>

        {/*
          The env kill switch is separate from the gym's toggles on purpose, so
          say so plainly rather than letting the toggles below look effective
          when the server will not act on them.
        */}
        {connection?.configured && !connection.enabled ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            Automatic sending is switched off on the server. Set <code>WHATSAPP_AUTO_SEND=true</code> in the backend
            <code> .env</code> and restart it — the toggles below have no effect until then.
          </p>
        ) : null}

        {connection?.error && connection.state !== "qr_pending" ? (
          <p className="text-destructive text-xs">{connection.error}</p>
        ) : null}

        {qr ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
            {/* biome-ignore lint/performance/noImgElement: a rotating data-URL QR cannot be optimised by next/image. */}
            <img src={qr} alt="WhatsApp pairing QR code" className="size-56 rounded-md bg-white p-2" />
            <p className="text-muted-foreground text-xs">This code refreshes every few seconds until it is scanned.</p>
          </div>
        ) : null}

        {/*
          Both recovery paths stay reachable whenever the gateway is up, not just
          while connected: a number that has fallen out of the session is exactly
          when someone needs them, and hiding them there left the only fix as an
          SSH session on the server.
        */}
        {connection?.configured && connection.state !== "unreachable" ? (
          <div className="flex flex-wrap items-center gap-2">
            {!connection.connected ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={reconnecting}
                onClick={() => void reconnect()}
              >
                {reconnecting ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Reconnect
              </Button>
            ) : null}

            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button type="button" variant="outline" size="sm" className="gap-1.5">
                    <Unlink className="size-3.5" />
                    {connection.connected ? "Unlink this number" : "Unlink and scan a new code"}
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unlink the gym's WhatsApp?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Automatic messages stop immediately, and someone has to scan a new code from the gym's phone to
                    start them again. Staff can still send by hand from the member's page.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction disabled={unlinking} onClick={() => void unlink()}>
                    {unlinking ? <Loader2 className="size-4 animate-spin" /> : null}
                    Unlink
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
