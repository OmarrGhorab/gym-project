import { describe, expect, it } from "vitest";

import { barcodeRects, encodeCode128 } from "./barcode";

/**
 * A wrong symbol prints a badge nobody can scan, so these assert the structural
 * invariants of Code128 rather than just "it returned something".
 */
describe("encodeCode128", () => {
  it("encodes a real employee attendance payload", () => {
    const encoding = encodeCode128("employee:E-646FJ0VVNM6O7TPE");

    expect(encoding).not.toBeNull();
    expect(encoding?.text).toBe("employee:E-646FJ0VVNM6O7TPE");
    expect(encoding?.bars).toMatch(/^[01]+$/);
  });

  it("starts with a Code128-B start symbol and ends with the stop pattern", () => {
    const bars = encodeCode128("member:M-F9OCCALTBF1CLUPH")?.bars ?? "";

    // Start Code B is 11010010000; the stop symbol is 13 modules: 1100011101011.
    expect(bars.startsWith("11010010000")).toBe(true);
    expect(bars.endsWith("1100011101011")).toBe(true);
  });

  it("produces a module count consistent with Code128 framing", () => {
    // 11 modules per symbol (start + data + checksum) plus a 13-module stop.
    const payload = "employee:E-ABCDEFGHIJKLMNOP";
    const bars = encodeCode128(payload)?.bars ?? "";
    const symbols = payload.length + 2; // start + data + checksum

    expect(bars.length).toBe(symbols * 11 + 13);
  });

  it("always begins and ends with a bar", () => {
    const bars = encodeCode128("employee:E-646FJ0VVNM6O7TPE")?.bars ?? "";

    expect(bars.at(0)).toBe("1");
    expect(bars.at(-1)).toBe("1");
  });

  it("returns null for input it cannot encode", () => {
    expect(encodeCode128("")).toBeNull();
    expect(encodeCode128("   ")).toBeNull();
  });

  it("distinguishes different codes", () => {
    const a = encodeCode128("employee:E-AAAAAAAAAAAAAAAA")?.bars;
    const b = encodeCode128("employee:E-AAAAAAAAAAAAAAAB")?.bars;

    expect(a).not.toBe(b);
  });
});

describe("barcodeRects", () => {
  it("collapses runs of bars into rectangles", () => {
    expect(barcodeRects("110011101")).toEqual([
      [0, 2],
      [4, 3],
      [8, 1],
    ]);
  });

  it("covers exactly the bar modules", () => {
    const bars = encodeCode128("employee:E-646FJ0VVNM6O7TPE")?.bars ?? "";
    const covered = barcodeRects(bars).reduce((total, [, span]) => total + span, 0);

    expect(covered).toBe([...bars].filter((module) => module === "1").length);
  });

  it("returns nothing for an all-space string", () => {
    expect(barcodeRects("0000")).toEqual([]);
  });
});

/**
 * Symbol width is what decides whether a badge is printable: Code128 spends
 * ~11 modules per character, so payload length translates directly into how
 * wide the printed barcode is, and how fine its bars get at a fixed card size.
 */
describe("symbol width", () => {
  it("keeps a short attendance code near retail-barcode proportions", () => {
    const bars = encodeCode128("M-K7QX9F")?.bars ?? "";

    // Comparable to the 8-character codes printed on ordinary retail labels.
    expect(bars.length).toBeLessThan(150);
  });

  it("is far narrower than the prefixed 16-character payload it replaced", () => {
    const short = encodeCode128("M-K7QX9F")?.bars.length ?? 0;
    const old = encodeCode128("member:M-QX8KURK9EFTERHEU")?.bars.length ?? 0;

    expect(old).toBeGreaterThan(300);
    expect(short).toBeLessThan(old / 2);
  });
});
