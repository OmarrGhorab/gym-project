export function normalizeWhatsAppPhone(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D+/g, "");

  if (!digits) {
    return null;
  }

  if (digits.startsWith("20")) {
    return digits;
  }

  if (digits.startsWith("0020")) {
    return digits.slice(2);
  }

  if (digits.startsWith("0")) {
    return `20${digits.slice(1)}`;
  }

  return digits;
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function buildQrImageUrl(payload: string | null | undefined, size = 220) {
  const value = String(payload ?? "").trim();

  if (!value) {
    return null;
  }

  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
}

/**
 * A hosted Code128 image of an attendance code, for sending in WhatsApp.
 *
 * Code128 and not QR, matching the printed badges (see lib/barcode.ts): the
 * gym's 1D laser scanners cannot read a 2D symbol.
 *
 * Encodes the bare code ("M-ABC234") exactly as the badge does, never the
 * prefixed "member:M-ABC234" payload. The M-/E- prefix already identifies the
 * type, and Code128 spends ~11 modules per character — carrying "member:" makes
 * the symbol ~55% wider for no benefit, at a module width lasers resolve less
 * reliably. The scan stations accept either form (AttendanceCode::parseForType).
 */
export function buildBarcodeImageUrl(code: string | null | undefined) {
  const value = String(code ?? "")
    .trim()
    // Tolerate being handed the prefixed payload instead of the bare code.
    .replace(/^(member|employee):/i, "");

  if (!value) {
    return null;
  }

  return `https://barcodeapi.org/api/128/${encodeURIComponent(value)}`;
}
