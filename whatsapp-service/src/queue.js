import { config } from "./config.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Serialises sends and spaces them out.
 *
 * One message at a time with a random 5–20s gap is the single most effective
 * thing we can do to keep the number alive: bans key off bursts of identical
 * messages fired milliseconds apart, which is exactly what an unthrottled queue
 * of subscription confirmations would look like.
 *
 * Depth is capped rather than unbounded so a backlog surfaces as a 429 that
 * Laravel can retry, instead of memory quietly filling up here.
 */
class SendQueue {
  constructor() {
    this.depth = 0;
    this.tail = Promise.resolve();
    this.lastSentAt = 0;
  }

  get pending() {
    return this.depth;
  }

  isFull() {
    return this.depth >= config.maxQueueDepth;
  }

  async enqueue(task) {
    if (this.isFull()) {
      throw Object.assign(new Error("Send queue is full"), { code: "queue_full" });
    }

    this.depth += 1;

    const run = this.tail.then(async () => {
      await this.#waitForGap();

      try {
        return await this.#withTimeout(task());
      } finally {
        // Stamp on completion, success or not: a failed send still cost an
        // interaction with WhatsApp and should not be followed instantly.
        this.lastSentAt = Date.now();
      }
    });

    // The chain must survive a rejected task, or one failure stalls everything
    // queued behind it.
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );

    try {
      return await run;
    } finally {
      this.depth -= 1;
    }
  }

  async #waitForGap() {
    const gap = config.minGapMs + Math.random() * Math.max(0, config.maxGapMs - config.minGapMs);
    const elapsed = Date.now() - this.lastSentAt;

    if (elapsed < gap) {
      await sleep(gap - elapsed);
    }
  }

  async #withTimeout(promise) {
    let timer;

    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(
        () => reject(Object.assign(new Error("Send timed out"), { code: "timeout" })),
        config.sendTimeoutMs,
      );
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}

export const sendQueue = new SendQueue();
