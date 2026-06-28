"use client";

import { QRCodeSVG } from "qrcode.react";

export function StaticQrCode({
  value,
  size,
}: {
  value: string;
  size: number;
}) {
  return <QRCodeSVG value={value} size={size} level="M" includeMargin />;
}
