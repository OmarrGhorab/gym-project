import sharp from "sharp";

// The barcode service answers in well under a second. This ceiling exists so a
// hung request cannot occupy the single send slot until the send timeout fires.
const FETCH_TIMEOUT_MS = 15000;

// A barcode PNG is well under 1KB. Anything approaching this is not our image.
const MAX_BYTES = 2 * 1024 * 1024;

// Rendered width before padding. The source barcode is only 338px wide, which
// scans poorly off a phone screen at arm's length from the door scanner.
const TARGET_WIDTH = 900;

// White quiet zone. Code 128 needs clear space either side of the bars or
// readers clip the start/stop pattern, and WhatsApp crops previews tight.
const QUIET_ZONE = 60;

/**
 * Fetch a barcode and normalise it into something WhatsApp actually renders.
 *
 * barcodeapi.org returns a 1-bit greyscale PNG. Baileys will happily upload
 * those bytes as-is, and WhatsApp accepts the message — but many clients cannot
 * draw a 1-bit PNG and show an empty placeholder with a download arrow instead.
 * Converting to a plain 8-bit JPEG on white, and attaching an explicit
 * thumbnail, is what makes the barcode visible in the chat.
 */
export async function fetchBarcodeImage(url) {
  const source = await download(url);

  const image = await sharp(source)
    .flatten({ background: "#ffffff" })
    .resize({ width: TARGET_WIDTH, fit: "inside" })
    .extend({
      top: QUIET_ZONE,
      bottom: QUIET_ZONE,
      left: QUIET_ZONE,
      right: QUIET_ZONE,
      background: "#ffffff",
    })
    .toColourspace("srgb")
    .jpeg({ quality: 92 })
    .toBuffer();

  // WhatsApp renders this inline before the full image is downloaded. Without
  // it the client has no dimensions to work with and falls back to a generic
  // tall grey box.
  const thumbnail = await sharp(image).resize({ width: 320, fit: "inside" }).jpeg({ quality: 60 }).toBuffer();

  return { image, thumbnail };
}

async function download(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`barcode request failed with ${response.status}`);
    }

    const type = response.headers.get("content-type") ?? "";

    if (!type.startsWith("image/")) {
      // barcodeapi.org rate-limits with an HTML body rather than a 429, so a
      // 200 alone is not proof we got a picture.
      throw new Error(`barcode request returned ${type || "no content type"}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.byteLength > MAX_BYTES) {
      throw new Error(`barcode image is ${buffer.byteLength} bytes, refusing`);
    }

    return buffer;
  } finally {
    clearTimeout(timer);
  }
}
