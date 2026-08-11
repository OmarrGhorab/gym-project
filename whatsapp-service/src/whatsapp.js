import { rm } from "node:fs/promises";

import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";

import { config } from "./config.js";
import { fetchBarcodeImage } from "./image.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "warn" });

/**
 * Build what goes on the wire.
 *
 * A barcode that cannot be fetched or converted must not cost the member their
 * message: the body already carries the barcode link as text, so falling back
 * to a plain message still gets them through the door. That is the only reason
 * the link is worth keeping in the template alongside the picture.
 */
async function buildPayload({ message, imageUrl }) {
  if (!imageUrl) {
    return { text: message };
  }

  try {
    const { image, thumbnail } = await fetchBarcodeImage(imageUrl);

    return { image, caption: message, mimetype: "image/jpeg", jpegThumbnail: thumbnail };
  } catch (error) {
    logger.warn({ imageUrl, err: error.message }, "barcode unavailable, sending text only");

    return { text: message };
  }
}

/**
 * Remembers the content of recently sent messages so retries can be answered.
 *
 * WhatsApp is multi-device: a message we send is encrypted separately for every
 * device on the account, including the gym's own phone and WhatsApp Desktop.
 * When one of those devices has no usable Signal session it cannot decrypt its
 * copy, so it asks the sender to send it again (a "retry receipt") and shows
 * "Waiting for this message. This may take a while." until the sender answers.
 *
 * Baileys answers that request by calling `getMessage` for the original
 * content. Its default implementation returns undefined, which means the retry
 * is silently dropped and the device waits forever — the phone still shows the
 * message because its session was already healthy.
 *
 * 512 entries is well past the ~256 WhatsApp itself keeps, and each entry is a
 * small protobuf, so the cap costs little and stops a long-running service from
 * growing without bound.
 */
class SentMessageStore {
  constructor(limit = 512) {
    this.limit = limit;
    this.messages = new Map();
  }

  remember(id, message) {
    if (!id || !message) {
      return;
    }

    // Re-inserting moves the key to the end, keeping eviction truly oldest-first.
    this.messages.delete(id);
    this.messages.set(id, message);

    while (this.messages.size > this.limit) {
      this.messages.delete(this.messages.keys().next().value);
    }
  }

  get(id) {
    return id ? this.messages.get(id) : undefined;
  }
}

/**
 * Holds the single WhatsApp Web session for the gym's number.
 *
 * The session survives restarts: Baileys writes its credentials to `authDir`
 * after the one-time QR scan, so the service reconnects on boot without anyone
 * touching a phone. The QR is only re-issued after an explicit unlink, or when
 * WhatsApp itself logs the device out.
 */
class WhatsAppConnection {
  constructor() {
    this.socket = null;
    this.state = "disconnected";
    this.qr = null;
    this.lastError = null;
    this.connectedNumber = null;
    this.starting = null;
    // Outlives the socket: a reconnect must not lose the messages a device is
    // still waiting on, since that is exactly when retries arrive.
    this.sentMessages = new SentMessageStore();
  }

  async start() {
    // Concurrent callers (boot, a reconnect, and a /qr poll) must share one
    // attempt, or we end up with rival sockets fighting over the same creds.
    if (this.starting) {
      return this.starting;
    }

    this.starting = this.#connect().finally(() => {
      this.starting = null;
    });

    return this.starting;
  }

  async #connect() {
    const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      logger,
      // The settings page renders the QR itself; printing it to stdout only
      // fills the pm2 log with noise.
      printQRInTerminal: false,
      browser: Browsers.ubuntu("Gym Dashboard"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      // Answers retry receipts. Without this a device that could not decrypt a
      // message stays stuck on "Waiting for this message" forever.
      getMessage: async (key) => this.sentMessages.get(key?.id),
    });

    this.socket = socket;
    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qr = qr;
        this.state = "qr_pending";
      }

      if (connection === "open") {
        this.qr = null;
        this.state = "connected";
        this.lastError = null;
        this.connectedNumber = socket.user?.id?.split(":")[0] ?? null;
        logger.info({ number: this.connectedNumber }, "WhatsApp connected");
      }

      if (connection === "close") {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        this.socket = null;
        this.connectedNumber = null;
        this.lastError = lastDisconnect?.error?.message ?? null;

        if (loggedOut) {
          // The number was unlinked from the phone. Credentials are dead; only
          // a fresh scan brings it back, so don't spin on reconnect attempts.
          this.state = "logged_out";
          logger.warn("WhatsApp logged out — re-link required");
          return;
        }

        this.state = "disconnected";
        logger.warn({ statusCode }, "WhatsApp disconnected, reconnecting");
        setTimeout(() => void this.start(), 3000);
      }
    });

    return socket;
  }

  isConnected() {
    return this.state === "connected" && this.socket !== null;
  }

  async status() {
    return {
      state: this.state,
      connected: this.isConnected(),
      number: this.connectedNumber,
      error: this.lastError,
    };
  }

  /** The pending QR as a data URL, for the dashboard to render. */
  async qrDataUrl() {
    if (!this.qr) {
      return null;
    }

    return QRCode.toDataURL(this.qr, { margin: 1, width: 320 });
  }

  /**
   * Unlink the number and wipe the stored credentials, so the next start()
   * issues a fresh QR.
   */
  async logout() {
    try {
      await this.socket?.logout();
    } catch {
      // Already gone — wiping the credentials below is what actually matters.
    }

    this.socket = null;
    this.state = "logged_out";
    this.qr = null;
    this.connectedNumber = null;

    await rm(config.authDir, { recursive: true, force: true });

    void this.start();
  }

  /**
   * Send one message. `imageUrl` turns it into an image with the text as the
   * caption, which is how the entry barcode reaches the member as something
   * scannable rather than a link they have to open.
   */
  async send({ phone, message, imageUrl }) {
    if (!this.isConnected()) {
      throw Object.assign(new Error(`WhatsApp is not connected (state: ${this.state})`), {
        code: "not_connected",
      });
    }

    const [result] = await this.socket.onWhatsApp(phone);

    if (!result?.exists) {
      throw Object.assign(new Error(`${phone} is not registered on WhatsApp`), {
        code: "not_on_whatsapp",
      });
    }

    const jid = result.jid;

    // Typing for a moment before sending mimics a person and avoids the
    // instant-reply pattern that automated senders are flagged for.
    await this.socket.sendPresenceUpdate("composing", jid);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await this.socket.sendPresenceUpdate("paused", jid);

    const sent = await this.socket.sendMessage(jid, await buildPayload({ message, imageUrl }));

    // Keep the plaintext content so a device that fails to decrypt its copy can
    // ask for it again and actually get it.
    this.sentMessages.remember(sent?.key?.id, sent?.message);

    return { id: sent?.key?.id ?? null, jid };
  }
}

export const whatsapp = new WhatsAppConnection();
