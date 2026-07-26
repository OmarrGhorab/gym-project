import JsBarcode from "jsbarcode";

/**
 * Code128 encoding for attendance badges.
 *
 * Code128 (not QR) on purpose: a 1D laser scanner — the common red-line type sold
 * for product barcodes — physically cannot read a 2D QR symbol, while both 1D
 * lasers and 2D imagers read Code128. Encoding here rather than in the browser
 * keeps badge sheets renderable on the server.
 */
export type BarcodeEncoding = {
  /** One character per module: "1" is a bar, "0" is a space. */
  bars: string;
  text: string;
};

/**
 * JsBarcode's "Object" renderer writes the encoding onto a plain object instead
 * of a canvas/SVG element, so no DOM is required.
 */
export function encodeCode128(value: string): BarcodeEncoding | null {
  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  const target: { encodings?: Array<{ data?: string; text?: string }> } = {};

  try {
    JsBarcode(target, trimmed, { format: "CODE128", displayValue: false });
  } catch {
    // Unencodable input (characters outside the Code128 range) — the caller
    // falls back to showing the plain text code.
    return null;
  }

  const encoding = target.encodings?.[0];

  if (!encoding?.data) {
    return null;
  }

  return { bars: encoding.data, text: encoding.text ?? trimmed };
}

/**
 * Collapse the module string into the smallest set of black rectangles, so the
 * printed SVG stays compact.
 *
 * @return list of [xModule, widthInModules] pairs
 */
export function barcodeRects(bars: string): Array<[number, number]> {
  const rects: Array<[number, number]> = [];
  let index = 0;

  while (index < bars.length) {
    if (bars[index] !== "1") {
      index += 1;
      continue;
    }

    let end = index;
    while (end < bars.length && bars[end] === "1") {
      end += 1;
    }

    rects.push([index, end - index]);
    index = end;
  }

  return rects;
}
