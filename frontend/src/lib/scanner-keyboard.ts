/**
 * Keyboard-wedge scanner decoding.
 *
 * A USB barcode scanner presents itself as a keyboard and emits US scancodes,
 * regardless of the keyboard layout the desk PC is switched to. That makes
 * `event.key` unreliable — under an Arabic layout the scanner's "Q" arrives as
 * "ض" — while `event.code`, the physical key, stays correct. Decoding from
 * `code` is layout-proof, which a character-substitution table can never be.
 */

/** Digit row when Shift is held, indexed by digit. */
const SHIFTED_DIGITS = ")!@#$%^&*(";

/** Punctuation keys as [unshifted, shifted]. */
const PUNCTUATION: Record<string, [string, string]> = {
  Minus: ["-", "_"],
  Equal: ["=", "+"],
  BracketLeft: ["[", "{"],
  BracketRight: ["]", "}"],
  Backslash: ["\\", "|"],
  Semicolon: [";", ":"],
  Quote: ["'", '"'],
  Backquote: ["`", "~"],
  Comma: [",", "<"],
  Period: [".", ">"],
  Slash: ["/", "?"],
  Space: [" ", " "],
};

/** Numeric keypad — some scanners emit the badge digits from here instead. */
const NUMPAD: Record<string, string> = {
  NumpadDivide: "/",
  NumpadMultiply: "*",
  NumpadSubtract: "-",
  NumpadAdd: "+",
  NumpadDecimal: ".",
};

export type ScannerKeyEvent = {
  code: string;
  key: string;
  shiftKey: boolean;
};

/**
 * The character this keystroke represents on a US layout, or null if the key
 * produces no character (modifiers, arrows, function keys).
 */
export function decodeScannerKey(event: ScannerKeyEvent): string | null {
  const { code, key, shiftKey } = event;

  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) {
    return shiftKey ? letter[1] : letter[1].toLowerCase();
  }

  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) {
    return shiftKey ? SHIFTED_DIGITS[Number(digit[1])] : digit[1];
  }

  const numpadDigit = /^Numpad([0-9])$/.exec(code);
  if (numpadDigit) {
    return numpadDigit[1];
  }

  if (code in NUMPAD) {
    return NUMPAD[code];
  }

  if (code in PUNCTUATION) {
    return PUNCTUATION[code][shiftKey ? 1 : 0];
  }

  // Unknown physical key: fall back to the layout-dependent character, but only
  // when it is printable ASCII — anything else is layout noise we cannot trust.
  if (key.length === 1 && key >= " " && key <= "~") {
    return key;
  }

  return null;
}

/** Keys scanners are configured to append after the payload. */
export function isScanTerminator(key: string): boolean {
  return key === "Enter" || key === "Tab";
}

/**
 * Longest pause between keystrokes still considered one scan.
 *
 * Scanners emit at roughly 5-15ms per character. Sustained sub-60ms typing is
 * beyond human reach, so this doubles as the "was that a machine?" test.
 */
export const SCAN_MAX_KEY_GAP_MS = 60;

/**
 * Silence after which a buffered burst is treated as complete.
 *
 * Not every scanner is configured with an Enter suffix; without this fallback a
 * suffix-less scanner fills the buffer and nothing ever submits.
 */
export const SCAN_QUIET_FLUSH_MS = 120;

/** Shorter bursts are stray keypresses, not a badge. */
export const SCAN_MIN_LENGTH = 4;

/** True when the keystroke should be left to the field the user is typing in. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}
