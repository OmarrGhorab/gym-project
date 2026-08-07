import { describe, expect, it } from "vitest";

import { decodeScannerKey, isEditableTarget, isScanTerminator } from "./scanner-keyboard";

/** Replays a badge scan as the browser reports it under a given layout. */
function scan(keys: Array<[code: string, key: string, shift?: boolean]>): string {
  return keys
    .map(([code, key, shift]) => decodeScannerKey({ code, key, shiftKey: shift ?? false }))
    .filter((char): char is string => char !== null)
    .join("");
}

describe("decodeScannerKey", () => {
  it("decodes a member badge typed under a US layout", () => {
    expect(
      scan([
        ["KeyM", "m"],
        ["KeyE", "e"],
        ["Semicolon", ":", true],
        ["KeyM", "M", true],
        ["Minus", "-"],
        ["Digit7", "7"],
      ]),
    ).toBe("me:M-7");
  });

  it("decodes the same scan when the desk PC is switched to an Arabic layout", () => {
    // The scanner emits identical scancodes; only event.key changes. This is the
    // exact case the old character-substitution table got wrong.
    expect(
      scan([
        ["KeyM", "ة"],
        ["KeyE", "ث"],
        ["Semicolon", "،", true],
        ["KeyM", "’", true],
        ["Minus", "-"],
        ["Digit7", "٧"],
      ]),
    ).toBe("me:M-7");
  });

  it("keeps digits as digits under a layout that reports Arabic-Indic numerals", () => {
    // Digits have no entry in a letter-substitution table, so they used to
    // survive as ٠١٢ and never match an attendance code.
    expect(scan([["Digit0", "٠"]])).toBe("0");
    expect(scan([["Digit9", "٩"]])).toBe("9");
  });

  it("distinguishes shifted from unshifted punctuation", () => {
    expect(decodeScannerKey({ code: "Semicolon", key: ";", shiftKey: false })).toBe(";");
    expect(decodeScannerKey({ code: "Semicolon", key: ":", shiftKey: true })).toBe(":");
    expect(decodeScannerKey({ code: "Minus", key: "-", shiftKey: false })).toBe("-");
    expect(decodeScannerKey({ code: "Minus", key: "_", shiftKey: true })).toBe("_");
  });

  it("reads digits emitted from the numeric keypad", () => {
    expect(scan([["Numpad4", "4"]])).toBe("4");
    expect(scan([["NumpadSubtract", "-"]])).toBe("-");
  });

  it("ignores keys that produce no character", () => {
    expect(decodeScannerKey({ code: "ShiftLeft", key: "Shift", shiftKey: true })).toBeNull();
    expect(decodeScannerKey({ code: "ArrowLeft", key: "ArrowLeft", shiftKey: false })).toBeNull();
    expect(decodeScannerKey({ code: "F5", key: "F5", shiftKey: false })).toBeNull();
    expect(decodeScannerKey({ code: "Enter", key: "Enter", shiftKey: false })).toBeNull();
  });

  it("falls back to the reported character for unmapped physical keys", () => {
    expect(decodeScannerKey({ code: "IntlBackslash", key: "$", shiftKey: false })).toBe("$");
  });

  it("refuses non-ASCII fallback characters rather than storing layout noise", () => {
    expect(decodeScannerKey({ code: "IntlYen", key: "ض", shiftKey: false })).toBeNull();
  });

  it("decodes a full attendance payload end to end", () => {
    const payload = "member:M-QX8KURK9EFTERHEU";
    const keys = payload.split("").map((char): [string, string, boolean] => {
      if (/[a-z]/.test(char)) return [`Key${char.toUpperCase()}`, char, false];
      if (/[A-Z]/.test(char)) return [`Key${char}`, char, true];
      if (/[0-9]/.test(char)) return [`Digit${char}`, char, false];
      if (char === ":") return ["Semicolon", ":", true];
      return ["Minus", "-", false];
    });

    expect(scan(keys)).toBe(payload);
  });
});

describe("isScanTerminator", () => {
  it("accepts both suffixes scanners ship with", () => {
    expect(isScanTerminator("Enter")).toBe(true);
    expect(isScanTerminator("Tab")).toBe(true);
  });

  it("rejects ordinary characters", () => {
    expect(isScanTerminator("a")).toBe(false);
    expect(isScanTerminator("Shift")).toBe(false);
  });
});

describe("isEditableTarget", () => {
  it("treats form fields as the user's own typing", () => {
    expect(isEditableTarget(document.createElement("input"))).toBe(true);
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
    expect(isEditableTarget(document.createElement("select"))).toBe(true);
  });

  it("lets scans through when focus is anywhere else", () => {
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
