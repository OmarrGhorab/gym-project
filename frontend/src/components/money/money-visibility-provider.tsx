"use client";

import * as React from "react";

import { type MoneyAccess, type MoneyDomain, NO_MONEY_ACCESS } from "@/lib/money-visibility";

const MoneyVisibilityContext = React.createContext<MoneyAccess>(NO_MONEY_ACCESS);

/**
 * Publishes the signed-in role's money access to the client tree.
 *
 * Mounted once in the dashboard layout so any component that renders a figure
 * can ask about its own domain, rather than every page threading booleans down
 * through props it otherwise has no use for.
 */
export function MoneyVisibilityProvider({ access, children }: { access: MoneyAccess; children: React.ReactNode }) {
  return <MoneyVisibilityContext.Provider value={access}>{children}</MoneyVisibilityContext.Provider>;
}

export function useMoneyAccess() {
  return React.useContext(MoneyVisibilityContext);
}

export function useCanViewMoney(domain: MoneyDomain) {
  return useMoneyAccess()[domain];
}
