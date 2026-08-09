import { timingSafeEqual } from "node:crypto";

import express from "express";

import { config } from "./config.js";
import { sendQueue } from "./queue.js";
import { whatsapp } from "./whatsapp.js";

const app = express();
app.use(express.json({ limit: "256kb" }));

function authorized(request) {
  const header = request.get("authorization") ?? "";
  const provided = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(config.token);

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

app.use((request, response, next) => {
  if (request.path === "/health" || authorized(request)) {
    return next();
  }

  return response.status(401).json({ message: "Unauthorized" });
});

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/status", async (_request, response) => {
  response.json({ ...(await whatsapp.status()), queued: sendQueue.pending });
});

app.get("/qr", async (_request, response) => {
  const qr = await whatsapp.qrDataUrl();
  const status = await whatsapp.status();

  response.json({ qr, state: status.state });
});

app.post("/logout", async (_request, response) => {
  await whatsapp.logout();
  response.json({ ok: true });
});

app.post("/send", async (request, response) => {
  const { phone, message, image_url: imageUrl } = request.body ?? {};

  if (typeof phone !== "string" || !/^\d{8,15}$/.test(phone)) {
    return response.status(422).json({ message: "phone must be digits only, in international format" });
  }

  if (typeof message !== "string" || message.trim() === "") {
    return response.status(422).json({ message: "message is required" });
  }

  // Reject before queueing rather than after a 20s wait, so Laravel learns the
  // number needs re-linking straight away.
  if (!whatsapp.isConnected()) {
    const status = await whatsapp.status();

    return response.status(503).json({ message: `WhatsApp is not connected (state: ${status.state})`, code: "not_connected" });
  }

  try {
    const result = await sendQueue.enqueue(() => whatsapp.send({ phone, message, imageUrl }));

    return response.json({ ok: true, ...result });
  } catch (error) {
    const statuses = {
      queue_full: 429,
      not_connected: 503,
      not_on_whatsapp: 422,
      timeout: 504,
    };

    return response.status(statuses[error.code] ?? 500).json({
      message: error.message,
      code: error.code ?? "send_failed",
    });
  }
});

app.listen(config.port, config.host, () => {
  console.log(`WhatsApp service listening on http://${config.host}:${config.port}`);
  void whatsapp.start();
});
