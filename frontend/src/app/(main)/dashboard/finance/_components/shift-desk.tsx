"use client";

import { type ReactNode, useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { closeShiftSession, reviewShiftHandover, submitShiftHandover } from "./actions";

export type ShiftDeskShift = {
  id: number;
  name: string;
};

export type ShiftDeskSession = {
  id: number;
  status: string;
  opening_float: string;
  expected_cash: string | null;
  expected_card: string | null;
  expected_bank: string | null;
  expected_expenses: string | null;
  expected_net: string | null;
  counted_cash: string | null;
  counted_card: string | null;
  counted_bank: string | null;
  counted_expenses: string | null;
  variance_notes?: string | null;
  variance?: {
    cash?: { expected: string | null; counted: string | null; variance: string | null };
    card?: { expected: string | null; counted: string | null; variance: string | null };
    bank?: { expected: string | null; counted: string | null; variance: string | null };
    expenses?: { expected: string | null; counted: string | null; variance: string | null };
  } | null;
  live_totals?: {
    cash: string;
    card: string;
    bank: string;
    expenses: string;
    net: string;
    opening_float?: string;
    collections?: string;
    refunds?: string;
    payment_count?: number;
    expense_count?: number;
    by_method?: {
      cash: string;
      card: string;
      bank: string;
    };
    by_source?: {
      subscriptions: string;
      addons: string;
      pos: string;
      other: string;
      refunds: string;
      expenses?: string;
    };
  } | null;
  shift?: { id: number; name: string } | null;
  previous_session_id?: number | null;
  opened_by?: { id: number; name: string } | null;
  closed_by?: { id: number; name: string } | null;
};

export function ShiftDesk({
  currentSession,
  pendingSessions = [],
  shifts: _shifts = [],
  requireHandoverToOpen: _requireHandoverToOpen = true,
  canOperate,
  canReview,
}: {
  currentSession: ShiftDeskSession | null;
  pendingSessions?: ShiftDeskSession[];
  shifts?: ShiftDeskShift[];
  requireHandoverToOpen?: boolean;
  canOperate: boolean;
  canReview: boolean;
}) {
  const t = useTranslations("Dashboard.finance");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [counted, setCounted] = useState({
    cash: "0.00",
    card: "0.00",
    bank: "0.00",
    expenses: "0.00",
  });
  const [varianceNotes, setVarianceNotes] = useState("");

  useEffect(() => {
    const source = pendingSessions[0];
    if (!source) {
      return;
    }

    setCounted({
      cash: source.counted_cash ?? source.expected_cash ?? "0.00",
      card: source.counted_card ?? source.expected_card ?? "0.00",
      bank: source.counted_bank ?? source.expected_bank ?? "0.00",
      expenses: source.counted_expenses ?? source.expected_expenses ?? "0.00",
    });
    setVarianceNotes(source.variance_notes ?? "");
  }, [pendingSessions]);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  let sessionBody: ReactNode;
  if (currentSession) {
    const live = currentSession.live_totals;
    const paymentCount = live?.payment_count ?? 0;
    const expenseCount = live?.expense_count ?? 0;
    const shiftName = currentSession.shift?.name ?? t("unknownShift");
    const openedByStaff = currentSession.opened_by?.name ?? "Staff";
    const hasMoney = paymentCount > 0 || expenseCount > 0 || Number(live?.expenses ?? 0) > 0;

    sessionBody = (
      <div className="grid gap-4 rounded-xl border bg-card/50 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base">{shiftName}</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 text-xs dark:bg-emerald-500/20 dark:text-emerald-400">
                #{currentSession.id} · {currentSession.status || "open"}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground text-xs">
              Staff on duty: <span className="font-medium text-foreground">{openedByStaff}</span>
              {currentSession.previous_session_id ? (
                <>
                  {" "}
                  · Handed over from session{" "}
                  <span className="font-medium text-foreground">#{currentSession.previous_session_id}</span>
                </>
              ) : null}
            </p>
          </div>
          {canOperate && currentSession.status === "open" ? (
            <Button
              size="sm"
              variant="default"
              disabled={pending}
              onClick={() => run(() => closeShiftSession(currentSession.id))}
            >
              {t("closeSession")} & Prepare Handover
            </Button>
          ) : null}
        </div>

        {/* Section 1: Received from Previous Shift */}
        <div className="space-y-1.5">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Received from Previous Shift
          </p>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Metric label={t("openingFloat")} value={moneyLabel(currentSession.opening_float, "0.00")} />
            <Metric
              label="Handover Source"
              value={
                currentSession.previous_session_id ? `Session #${currentSession.previous_session_id}` : "Initial float"
              }
            />
            <Metric label="Opened By" value={openedByStaff} />
          </div>
        </div>

        {/* Section 2: Current Shift Statistics */}
        <div className="space-y-1.5">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Current Shift Performance & Revenue
          </p>
          <div className="grid gap-2 rounded-lg border border-dashed bg-muted/20 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Metric label={t("shiftSubscriptionRevenue")} value={moneyLabel(live?.by_source?.subscriptions, "0.00")} />
            <Metric label={t("shiftAddonRevenue")} value={moneyLabel(live?.by_source?.addons, "0.00")} />
            <Metric label={t("shiftPosRevenue")} value={moneyLabel(live?.by_source?.pos, "0.00")} />
            <Metric label={t("shiftCollections")} value={moneyLabel(live?.collections, "0.00")} />
            <Metric
              label={t("shiftExpensesLabel")}
              value={moneyLabel(live?.expenses, currentSession.expected_expenses)}
            />
            <Metric label={t("shiftRefunds")} value={moneyLabel(live?.refunds, "0.00")} />
          </div>
        </div>

        {/* Section 3: To Hand Over to Next Shift */}
        <div className="space-y-1.5">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
            To Hand Over to Next Shift (System Totals)
          </p>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Expected Cash in Drawer (incl. Float)"
              value={moneyLabel(live?.cash, currentSession.expected_cash)}
            />
            <Metric label="Expected Card Receipts" value={moneyLabel(live?.card, currentSession.expected_card)} />
            <Metric label="Expected Bank Transfers" value={moneyLabel(live?.bank, currentSession.expected_bank)} />
            <Metric label="Net Session Balance" value={moneyLabel(live?.net, currentSession.expected_net)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
          <p className="text-muted-foreground">
            {t("shiftTrackingHelpDetailed", {
              payments: paymentCount,
              expenses: expenseCount,
            })}
          </p>
        </div>

        {!hasMoney ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-900 text-xs dark:text-amber-100">
            {t("shiftOpenNoPaymentsHint")}
          </div>
        ) : null}
      </div>
    );
  } else {
    sessionBody = (
      <div className="grid gap-3 rounded-lg border border-dashed bg-muted/10 p-4 text-center">
        <p className="font-medium text-foreground text-sm">
          Shift desk is active and managed dynamically by system shift schedules.
        </p>
        <p className="text-muted-foreground text-xs">
          Shift sessions auto-start based on your assigned shift schedule and current operational hours.
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">{t("shiftDesk")}</CardTitle>
        <CardDescription>{t("shiftDeskDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {sessionBody}

        {pendingSessions.length > 0 ? (
          <div className="grid gap-3">
            <div>
              <p className="font-medium text-sm">{t("pendingHandovers")}</p>
              <p className="text-muted-foreground text-xs">{t("handoverWorkflowHelp")}</p>
            </div>
            {pendingSessions.map((session) => {
              const live = session.live_totals;
              const lines = [
                {
                  key: "cash" as const,
                  label: t("shiftCash"),
                  expected: session.expected_cash,
                  counted: session.counted_cash,
                  variance: session.variance?.cash?.variance,
                },
                {
                  key: "card" as const,
                  label: t("shiftCard"),
                  expected: session.expected_card,
                  counted: session.counted_card,
                  variance: session.variance?.card?.variance,
                },
                {
                  key: "bank" as const,
                  label: t("shiftBank"),
                  expected: session.expected_bank,
                  counted: session.counted_bank,
                  variance: session.variance?.bank?.variance,
                },
                {
                  key: "expenses" as const,
                  label: t("shiftExpensesLabel"),
                  expected: session.expected_expenses,
                  counted: session.counted_expenses,
                  variance: session.variance?.expenses?.variance,
                },
              ];

              return (
                <div key={session.id} className="grid gap-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">
                        #{session.id} · {session.shift?.name ?? t("shift")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t("shiftStatus")}: <span className="font-medium text-foreground">{session.status}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <Metric
                      label={t("shiftSubscriptionRevenue")}
                      value={moneyLabel(live?.by_source?.subscriptions, "0.00")}
                    />
                    <Metric label={t("shiftAddonRevenue")} value={moneyLabel(live?.by_source?.addons, "0.00")} />
                    <Metric label={t("shiftPosRevenue")} value={moneyLabel(live?.by_source?.pos, "0.00")} />
                    <Metric label={t("shiftNet")} value={moneyLabel(session.expected_net, live?.net)} />
                  </div>

                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[28rem] text-left text-sm">
                      <thead className="bg-muted/40 text-muted-foreground text-xs">
                        <tr>
                          <th className="px-3 py-2 font-medium">{t("handoverLine")}</th>
                          <th className="px-3 py-2 font-medium">{t("systemExpected")}</th>
                          <th className="px-3 py-2 font-medium">{t("physicallyCounted")}</th>
                          <th className="px-3 py-2 font-medium">{t("variance")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <tr key={line.key} className="border-t">
                            <td className="px-3 py-2">{line.label}</td>
                            <td className="px-3 py-2 tabular-nums">{moneyLabel(line.expected, "0.00")}</td>
                            <td className="px-3 py-2 tabular-nums">{moneyLabel(line.counted, "—")}</td>
                            <td className="px-3 py-2 tabular-nums">{formatVariance(line.variance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {canOperate && (session.status === "pending_handover" || session.status === "disputed") ? (
                    <div className="grid gap-3">
                      <p className="text-muted-foreground text-xs">{t("handoverCountHelp")}</p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {(["cash", "card", "bank", "expenses"] as const).map((field) => (
                          <div key={field} className="grid gap-1">
                            <Label>{t(`counted_${field}` as "counted_cash")}</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={counted[field]}
                              onChange={(event) =>
                                setCounted((current) => ({ ...current, [field]: event.currentTarget.value }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor={`variance-notes-${session.id}`}>{t("varianceNotes")}</Label>
                        <Input
                          id={`variance-notes-${session.id}`}
                          value={varianceNotes}
                          placeholder={t("varianceNotesPlaceholder")}
                          onChange={(event) => setVarianceNotes(event.currentTarget.value)}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              submitShiftHandover(session.id, {
                                counted_cash: counted.cash,
                                counted_card: counted.card,
                                counted_bank: counted.bank,
                                counted_expenses: counted.expenses,
                                variance_notes: varianceNotes || undefined,
                              }),
                            )
                          }
                        >
                          {t("submitHandoverOk")}
                        </Button>
                        <p className="self-center text-muted-foreground text-xs">{t("submitHandoverOkHelp")}</p>
                      </div>
                    </div>
                  ) : null}

                  {canReview && session.status === "pending_admin" ? (
                    <div className="grid gap-2">
                      <p className="text-muted-foreground text-xs">{t("adminReviewHelp")}</p>
                      {session.variance_notes ? (
                        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs">
                          <span className="font-medium">{t("varianceNotes")}: </span>
                          {session.variance_notes}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() => run(() => reviewShiftHandover(session.id, "accepted"))}
                        >
                          {t("acceptHandoverPerfect")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => run(() => reviewShiftHandover(session.id, "rejected"))}
                        >
                          {t("appealHandover")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function moneyLabel(primary: string | null | undefined, fallback: string | null | undefined): string {
  if (primary === "—" || fallback === "—") {
    if ((primary == null || primary === "") && fallback === "—") {
      return "—";
    }
    if (primary === "—") {
      return "—";
    }
  }

  let raw = "0.00";
  if (primary != null && primary !== "" && primary !== "—") {
    raw = primary;
  } else if (fallback != null && fallback !== "") {
    raw = fallback;
  }
  if (raw === "—") {
    return "—";
  }

  const amount = Number(raw);

  if (!Number.isFinite(amount)) {
    return "EGP 0.00";
  }

  return `EGP ${amount.toFixed(2)}`;
}

function formatVariance(value: string | null | undefined): string {
  if (value == null || value === "") {
    return "—";
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "—";
  }

  const sign = amount > 0 ? "+" : "";
  return `${sign}EGP ${amount.toFixed(2)}`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}
