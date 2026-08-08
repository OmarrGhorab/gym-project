import { describe, expect, it } from "vitest";

import { buildWhatsAppLink } from "@/components/whatsapp-notification-button";
import { buildBarcodeImageUrl } from "@/lib/whatsapp";

describe("buildBarcodeImageUrl", () => {
  it("encodes the bare code, matching what the printed badge encodes", () => {
    expect(buildBarcodeImageUrl("M-ABC234")).toBe("https://barcodeapi.org/api/128/M-ABC234");
  });

  it("strips a prefixed payload so the symbol stays narrow", () => {
    // "member:M-ABC234" renders ~55% wider than "M-ABC234" for no added meaning.
    expect(buildBarcodeImageUrl("member:M-ABC234")).toBe("https://barcodeapi.org/api/128/M-ABC234");
    expect(buildBarcodeImageUrl("employee:E-ABC234")).toBe("https://barcodeapi.org/api/128/E-ABC234");
  });

  it("returns null for a member with no attendance code", () => {
    expect(buildBarcodeImageUrl(null)).toBeNull();
    expect(buildBarcodeImageUrl("   ")).toBeNull();
  });
});

describe("buildWhatsAppLink", () => {
  // Regression: a placeholder with no matching key renders as an empty string, so
  // confirmation messages went out with blank date/amount/barcode lines.
  it("fills every placeholder of the subscription confirmation template", () => {
    const link = buildWhatsAppLink(
      "01001234567",
      {
        member_name: "Nour",
        plan_name: "Gold",
        start_date: "2026-06-10",
        end_date: "2026-09-10",
        amount_paid: "450.00",
        attendance_code: "M-ABC234",
      },
      {},
      "ar",
      "subscription_confirmation",
    );

    const message = new URL(link).searchParams.get("text") ?? "";

    expect(message).toContain("Nour");
    expect(message).toContain("2026-06-10");
    expect(message).toContain("2026-09-10");
    expect(message).toContain("450.00");
    expect(message).toContain("https://barcodeapi.org/api/128/M-ABC234");
    expect(message).not.toMatch(/{{\s*\w+\s*}}/);
  });

  it("falls back to the prefixed payload when the bare code is absent", () => {
    const link = buildWhatsAppLink(
      "01001234567",
      { attendance_qr: "member:M-ABC234" },
      {},
      "ar",
      "renewal_confirmation",
    );

    expect(new URL(link).searchParams.get("text") ?? "").toContain("https://barcodeapi.org/api/128/M-ABC234");
  });
});
