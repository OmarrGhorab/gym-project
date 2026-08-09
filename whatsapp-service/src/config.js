import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

// Resolve everything against the service directory rather than process.cwd().
// Cron starts jobs in the home directory, so a cwd-relative .env would be
// silently skipped and a cwd-relative auth_info would put the linked-device
// credentials somewhere the next run cannot find them.
const serviceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({ path: resolve(serviceRoot, ".env") });

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required. Copy .env.example to .env and fill it in.`);
  }

  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  // Bind to loopback by default. Laravel runs on the same VPS, so the service
  // never needs to be reachable from the internet — and it must not be, since
  // anyone who reaches it can send messages as the gym.
  host: process.env.HOST ?? "127.0.0.1",
  token: required("WHATSAPP_SERVICE_TOKEN"),
  authDir: resolve(serviceRoot, process.env.AUTH_DIR ?? "auth_info"),

  // Throttling. Sends are serialised with a random gap in this range, because
  // a burst of identical messages from one number is the pattern WhatsApp bans
  // for. Slower than necessary is the point.
  minGapMs: Number(process.env.MIN_GAP_MS ?? 5000),
  maxGapMs: Number(process.env.MAX_GAP_MS ?? 20000),

  // How many messages may wait in line before /send starts rejecting with 429.
  // Laravel releases those jobs back onto its own queue and retries later, so a
  // full queue delays messages rather than losing them.
  maxQueueDepth: Number(process.env.MAX_QUEUE_DEPTH ?? 100),

  // How long a single send may take before it is treated as failed.
  sendTimeoutMs: Number(process.env.SEND_TIMEOUT_MS ?? 60000),
};
