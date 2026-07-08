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
