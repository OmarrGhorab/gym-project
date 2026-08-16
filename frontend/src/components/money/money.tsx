"use client";

import type * as React from "react";

import { MONEY_REDACTED, type MoneyDomain } from "@/lib/money-visibility";
import { cn } from "@/lib/utils";

import { useCanViewMoney } from "./money-visibility-provider";

/**
 * Renders a figure, or a placeholder when the role may not see that domain.
 *
 * `children` carries the already-formatted amount so each page keeps its own
 * currency, locale, and decimal conventions instead of this component guessing
 * at them.
 */
export function Money({
  children,
  className,
  domain,
  redacted = MONEY_REDACTED,
}: {
  children: React.ReactNode;
  className?: string;
  domain: MoneyDomain;
  redacted?: React.ReactNode;
}) {
  const canView = useCanViewMoney(domain);

  if (!canView) {
    // `title` rather than `aria-label`: a plain span has no role to label, and a
    // screen reader reads the dash either way.
    return (
      <span className={cn("text-muted-foreground tabular-nums", className)} title="Hidden">
        {redacted}
      </span>
    );
  }

  return <span className={className}>{children}</span>;
}

/** Drops its subtree entirely — for whole cards, columns, or charts made only of figures. */
export function MoneyOnly({ children, domain }: { children: React.ReactNode; domain: MoneyDomain }) {
  return useCanViewMoney(domain) ? children : null;
}
