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

// Reconnect backoff. A flat retry hammers WhatsApp when the fault is on their
// side, and the states worth retrying at all (network blip, restart required)
// clear in seconds; anything still failing after a minute needs a human.
const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS = 60000;

// A logout that cannot reach the server would otherwise hang the HTTP request
// that asked for it. Telling WhatsApp is the polite part; wiping the local
// credentials below is the part that actually unlinks the number.
const LOGOUT_TIMEOUT_MS = 5000;

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
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
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

  /**
   * Reconnect with the credentials we already have.
   *
   * Separate from logout(): the number is still linked and the pairing is still
   * good, this only rebuilds the socket. That is the whole fix for a session
   * another process took over, and it must not cost anyone a QR scan.
   */
  async reconnect() {
    this.reconnectAttempts = 0;

    return this.start();
  }

  async #connect() {
    this.#cancelReconnect();
    // Two live sockets on one set of credentials is what WhatsApp answers with
    // a `conflict` stream error, so the old one goes before the new one exists.
    await this.#discard(this.socket);

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
      // A socket we have already replaced still emits its own close. Letting it
      // through would null out the live socket and schedule a second reconnect,
      // which is how one blip turns into several sockets on the same number.
      if (this.socket !== socket) {
        return;
      }

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qr = qr;
        this.state = "qr_pending";
      }

      if (connection === "open") {
        this.qr = null;
        this.state = "connected";
        this.lastError = null;
        this.reconnectAttempts = 0;
        this.connectedNumber = socket.user?.id?.split(":")[0] ?? null;
        logger.info({ number: this.connectedNumber }, "WhatsApp connected");
      }

      if (connection === "close") {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;

        this.socket = null;
        this.connectedNumber = null;
        this.qr = null;
        this.lastError = lastDisconnect?.error?.message ?? null;
        socket.ev.removeAllListeners("connection.update");
        socket.ev.removeAllListeners("creds.update");

        if (statusCode === DisconnectReason.loggedOut) {
          // The number was unlinked from the phone (WhatsApp sends this as
          // `<stream:error code="401"><conflict type="device_removed"/>`, so it
          // reads as "Stream Errored (conflict)"). The stored credentials are
          // dead: reconnecting on them only earns another 401 and never a QR,
          // so they have to go before we can offer a fresh pairing code.
          this.state = "logged_out";
          logger.warn("WhatsApp logged out — wiping credentials for a fresh QR");
          void this.#relink();
          return;
        }

        if (statusCode === DisconnectReason.connectionReplaced) {
          // Something else linked as this same device and took the session.
          // Reconnecting would take it back and get us replaced again, forever,
          // so stop and say so — the fix is killing the other process, not
          // winning the fight.
          this.state = "conflict";
          logger.error("WhatsApp session replaced by another instance — not reconnecting");
          return;
        }

        if (statusCode === DisconnectReason.restartRequired) {
          // Not a fault: Baileys asks for exactly one reconnect straight after a
          // successful pairing. Making whoever just scanned the code wait out a
          // backoff would read as the scan not having worked.
          this.reconnectAttempts = 0;
        }

        this.state = "disconnected";
        logger.warn({ statusCode }, "WhatsApp disconnected, reconnecting");
        this.#scheduleReconnect();
      }
    });

    return socket;
  }

  /** Wipe the dead pairing and come back with a QR nobody has to SSH in for. */
  async #relink() {
    try {
      await rm(config.authDir, { recursive: true, force: true });
      await this.start();
    } catch (error) {
      this.lastError = error.message;
      logger.error({ err: error.message }, "could not restart after logout");
    }
  }

  /**
   * End a socket for good: listeners off first, so the close it emits on the
   * way out cannot be mistaken for the live session going down.
   */
  async #discard(socket) {
    if (!socket) {
      return;
    }

    if (this.socket === socket) {
      this.socket = null;
    }

    socket.ev.removeAllListeners("connection.update");
    socket.ev.removeAllListeners("creds.update");

    try {
      socket.end(undefined);
    } catch {
      // Already down. Nothing left to release.
    }
  }

  #scheduleReconnect() {
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempts, RECONNECT_MAX_MS);
    this.reconnectAttempts += 1;

    this.#cancelReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.start();
    }, delay);
  }

  #cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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
    this.#cancelReconnect();

    const socket = this.socket;
    // Taken off `this.socket` before anything can fail, so the close it emits
    // is read as "we ended it" rather than "the session dropped".
    this.socket = null;

    try {
      await Promise.race([
        socket?.logout(),
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error("logout timed out")), LOGOUT_TIMEOUT_MS)),
      ]);
    } catch {
      // Already gone, or unreachable. Wiping the credentials below is what
      // actually unlinks the number.
    }

    // Even a logout() that threw can leave the socket alive, and a live socket
    // still holds a creds.update listener that would write the credentials
    // straight back into the directory we are about to wipe.
    await this.#discard(socket);

    this.state = "logged_out";
    this.qr = null;
    this.connectedNumber = null;
    this.lastError = null;
    this.reconnectAttempts = 0;

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
