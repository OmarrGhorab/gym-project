import { useCallback } from "react";

import { useCanViewMoney } from "@/components/money/money-visibility-provider";
import { MONEY_REDACTED } from "@/lib/money-visibility";

export function formatEgp(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value);

  return new Intl.NumberFormat("en", {
    currency: "EGP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatSignedPercent(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;

  return `${safe > 0 ? "+" : ""}${safe.toFixed(1)}%`;
}

/**
 * POS figures, withheld from roles without sales-money visibility.
 *
 * A formatter rather than a wrapper component: most POS amounts are built into
 * metric strings and chart tooltips, where a component has nowhere to render.
 */
export function usePosMoney() {
  const canView = useCanViewMoney("sales");

  return useCallback((value: string | number) => (canView ? formatEgp(value) : MONEY_REDACTED), [canView]);
}
