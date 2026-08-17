"use client";

import { type ReactNode, useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Money } from "@/components/money/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  assignShiftStaff,
  closeShiftSession,
  openShiftSession,
  reviewShiftHandover,
  submitShiftHandover,
} from "./actions";

export type ShiftDeskStaff = {
  id: number;
  name: string;
  role?: string | null;
};

export type ShiftDeskShift = {
  id: number;
  name: string;
  employees?: ShiftDeskStaff[];
};

/**
 * How much of a session's money the signed-in user may be shown.
 *
 * "own" is the desk employee looking at their own shift: what they collected,
 * never the cash the shift before them left in the drawer. "none" is somebody
 * else's shift — it exists, and who is on it, and nothing more. The API decides
 * this; the desk only renders what it is given.
 */
export type ShiftMoneyScope = "full" | "own" | "none";

export type ShiftDeskSession = {
  id: number;
  business_date?: string | null;
  status: string;
  money_scope?: ShiftMoneyScope;
  opening_float: string | null;
  expected_cash: string | null;
  /**
   * Takings for the shift with the inherited float removed — what this shift
   * earned, as opposed to what is sitting in the drawer. Admin-only, and null
   * until the shift closes; while it is open the same figures are live.
   */
  collected_cash?: string | null;
  collected_total?: string | null;
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
    cash?: string;
    card?: string;
    bank?: string;
    expenses?: string;
    net?: string;
    opening_float?: string | null;
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
  staff_on_duty?: { id: number; name: string; role?: string | null } | null;
  closed_by_employee?: { id: number; name: string; role?: string | null } | null;
};

export function ShiftDesk({
  currentSession,
  historySessions = [],
  pendingSessions = [],
  shifts = [],
  requireHandoverToOpen: _requireHandoverToOpen = true,
  requireCashCount = false,
  canOperate,
  canReview,
}: {
  currentSession: ShiftDeskSession | null;
  historySessions?: ShiftDeskSession[];
  pendingSessions?: ShiftDeskSession[];
  shifts?: ShiftDeskShift[];
  requireHandoverToOpen?: boolean;
  requireCashCount?: boolean;
  canOperate: boolean;
  canReview: boolean;
}) {
  const t = useTranslations("Dashboard.finance");
  const router = useRouter();
  // One session stamped "full" means this viewer reads across shifts — the API
  // grants that to administrators only, so the desk does not re-derive it.
  const seesAllShifts = [currentSession, ...historySessions, ...pendingSessions].some(
    (session) => session?.money_scope === "full",
  );
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
    // The accountable employee of this shift — the acting user account is only the audit trail.
    const staffOnDuty = currentSession.staff_on_duty?.name ?? currentSession.opened_by?.name ?? t("automaticSystem");
    const openedByStaff = currentSession.opened_by?.name ?? staffOnDuty;
    const hasMoney = paymentCount > 0 || expenseCount > 0 || Number(live?.expenses ?? 0) > 0;
    // The API redacts the figures themselves; this only decides which headings
    // and sections are worth rendering at all.
    const seesEveryShift = currentSession.money_scope === "full";
    const seesOwnMoney = seesEveryShift || currentSession.money_scope !== "none";

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
              Staff on duty: <span className="font-medium text-foreground">{staffOnDuty}</span>
              {currentSession.previous_session_id ? (
                <>
                  {" "}
                  · Handed over from session{" "}
                  <span className="font-medium text-foreground">#{currentSession.previous_session_id}</span>
                </>
              ) : null}
            </p>
            {canOperate && currentSession.status === "open" ? (
              <AssignStaffControl
                currentStaffId={currentSession.staff_on_duty?.id ?? null}
                pending={pending}
                sessionId={currentSession.id}
                staff={shifts.find((shift) => shift.id === currentSession.shift?.id)?.employees ?? []}
                onAssign={run}
              />
            ) : null}
          </div>
          {canOperate && currentSession.status === "open" ? (
            <div className="flex flex-col items-end gap-1">
              <Button size="sm" disabled={pending} onClick={() => run(() => closeShiftSession(currentSession.id))}>
                {t("endShiftAndCountCash")}
              </Button>
              <span className="text-[11px] text-muted-foreground">{t("endShiftHint")}</span>
            </div>
          ) : null}
        </div>

        {/*
          Section 1: Received from Previous Shift — the drawer the last employee
          left. Only an admin reconciling the two shifts sees it; the employee on
          duty is answerable for what they take in, not for what was already
          there when they sat down.
        */}
        {seesEveryShift ? (
          <div className="space-y-1.5">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Received from Previous Shift
            </p>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Metric label={t("openingFloat")} value={moneyLabel(currentSession.opening_float, "0.00")} />
              <Metric
                label="Handover Source"
                plain
                value={
                  currentSession.previous_session_id
                    ? `Session #${currentSession.previous_session_id}`
                    : "Initial float"
                }
              />
              <Metric label="Opened By" plain value={openedByStaff} />
            </div>
          </div>
        ) : (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Metric label="Opened By" plain value={openedByStaff} />
          </div>
        )}

        {/*
          Somebody else is on the desk. That it is open has to be visible, or a
          second session gets opened on top of it — their takings do not.
        */}
        {!seesOwnMoney ? (
          <div className="rounded-md border border-dashed bg-muted/10 px-3 py-2 text-muted-foreground text-xs">
            {staffOnDuty} is on this shift. Their takings are shown to them and to an administrator.
          </div>
        ) : null}

        {/* Section 2: Current Shift Statistics */}
        {seesOwnMoney ? (
          <div className="space-y-1.5">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Current Shift Performance & Revenue
            </p>
            <div className="grid gap-2 rounded-lg border border-dashed bg-muted/20 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Metric
                label={t("shiftSubscriptionRevenue")}
                value={moneyLabel(live?.by_source?.subscriptions, "0.00")}
              />
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
        ) : null}

        {/*
          Section 3: the shift's own totals. The admin heading says "in the
          drawer" because that figure carries the float; the employee's says
          "you collected", because theirs does not.
        */}
        {seesOwnMoney ? (
          <div className="space-y-1.5">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              {seesEveryShift ? "To Hand Over to Next Shift (System Totals)" : "Collected on This Shift"}
            </p>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label={seesEveryShift ? "Expected Cash in Drawer (incl. Float)" : "Cash You Collected"}
                value={moneyLabel(live?.cash, seesEveryShift ? currentSession.expected_cash : undefined)}
              />
              {/*
                The drawer figure above carries the float it opened on, so on a
                large float it says little about how the shift did. This is the
                same number with the float taken back out — the shift's own cash.
              */}
              {seesEveryShift ? (
                <Metric
                  label="Cash Collected This Shift (excl. Float)"
                  value={moneyLabel(live?.by_method?.cash, currentSession.collected_cash)}
                />
              ) : null}
              <Metric label="Expected Card Receipts" value={moneyLabel(live?.card, currentSession.expected_card)} />
              <Metric label="Expected Bank Transfers" value={moneyLabel(live?.bank, currentSession.expected_bank)} />
              {seesEveryShift ? (
                <Metric
                  label="Total Collected This Shift"
                  value={moneyLabel(live?.collections, currentSession.collected_total)}
                />
              ) : null}
              <Metric
                label={seesEveryShift ? "Net Session Balance" : "Net for Your Shift"}
                value={moneyLabel(live?.net, seesEveryShift ? currentSession.expected_net : undefined)}
              />
            </div>
          </div>
        ) : null}

        {seesOwnMoney ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
            <p className="text-muted-foreground">
              {t("shiftTrackingHelpDetailed", {
                payments: paymentCount,
                expenses: expenseCount,
              })}
            </p>
          </div>
        ) : null}

        {seesOwnMoney && !hasMoney ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-900 text-xs dark:text-amber-100">
            {t("shiftOpenNoPaymentsHint")}
          </div>
        ) : null}
      </div>
    );
  } else if (canOperate) {
    sessionBody = <OpenSessionForm shifts={shifts} pending={pending} onOpen={run} />;
  } else {
    sessionBody = (
      <div className="grid gap-3 rounded-lg border border-dashed bg-muted/10 p-4 text-center">
        <p className="font-medium text-foreground text-sm">No shift session is open.</p>
        <p className="text-muted-foreground text-xs">
          An employee assigned to the shift has to open the desk before money can be tracked.
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

        {/* With counting off, CloseShiftSession finishes the session outright, so
            nothing lands in pendingSessions and this block never renders. The guard
            is explicit so an old pending row from before the switch cannot resurrect
            a workflow the gym has turned off. */}
        {requireCashCount && pendingSessions.length > 0 ? (
          <div className="grid gap-3">
            <div>
              <p className="font-medium text-sm">{t("finishHandover")}</p>
              <p className="text-muted-foreground text-xs">{t("handoverWorkflowHelp")}</p>
            </div>
            {pendingSessions.map((session) => {
              const live = session.live_totals;
              // What the system expected, and how far off the count is, is the
              // judgement an admin makes on this employee's drawer — and the
              // expected cash carries the previous shift's float besides. The
              // employee counts what is in front of them and submits it.
              const seesReconciliation = session.money_scope === "full";
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
                    <Metric
                      label={t("shiftNet")}
                      value={moneyLabel(seesReconciliation ? session.expected_net : undefined, live?.net)}
                    />
                  </div>

                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[28rem] text-left text-sm">
                      <thead className="bg-muted/40 text-muted-foreground text-xs">
                        <tr>
                          <th className="px-3 py-2 font-medium">{t("handoverLine")}</th>
                          {seesReconciliation ? (
                            <th className="px-3 py-2 font-medium">{t("systemExpected")}</th>
                          ) : null}
                          <th className="px-3 py-2 font-medium">{t("physicallyCounted")}</th>
                          {seesReconciliation ? <th className="px-3 py-2 font-medium">{t("variance")}</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <tr key={line.key} className="border-t">
                            <td className="px-3 py-2">{line.label}</td>
                            {seesReconciliation ? (
                              <td className="px-3 py-2 tabular-nums">
                                <Money domain="sales">{moneyLabel(line.expected, "0.00")}</Money>
                              </td>
                            ) : null}
                            <td className="px-3 py-2 tabular-nums">
                              <Money domain="sales">{moneyLabel(line.counted, "—")}</Money>
                            </td>
                            {seesReconciliation ? (
                              <td className="px-3 py-2 tabular-nums">
                                <Money domain="sales">{formatVariance(line.variance)}</Money>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {canOperate && (session.status === "pending_handover" || session.status === "disputed") ? (
                    <div className="grid gap-3">
                      <p className="font-medium text-sm">{t("handoverStepCount")}</p>
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
                              onChange={(event) => {
                                const val = event.target.value;
                                setCounted((current) => ({ ...current, [field]: val }));
                              }}
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
                          {t("handoverStepSend")}
                        </Button>
                        <p className="self-center text-muted-foreground text-xs">{t("submitHandoverOkHelp")}</p>
                      </div>
                    </div>
                  ) : null}

                  {canReview && session.status === "pending_admin" ? (
                    <div className="grid gap-2">
                      <p className="font-medium text-sm">{t("handoverStepReview")}</p>
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

        {/*
          Past shifts are one employee's account of their own money. Reading them
          side by side is an administrator's job, and the API only stamps their
          sessions "full" — so an employee never sees this list, even for the
          shift they worked themselves.
        */}
        {canReview && seesAllShifts && historySessions.length > 0 ? (
          <ShiftSessionHistory sessions={historySessions} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function ShiftSessionHistory({ sessions }: { sessions: ShiftDeskSession[] }) {
  const t = useTranslations("Dashboard.finance");

  return (
    <div className="grid gap-3 border-t pt-4">
      <div>
        <p className="font-medium text-sm">{t("shiftHistory")}</p>
        <p className="text-muted-foreground text-xs">{t("shiftHistoryHelp")}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="px-3 py-2 font-medium">{t("shiftHistoryDate")}</th>
              <th className="px-3 py-2 font-medium">{t("shift")}</th>
              <th className="px-3 py-2 font-medium">{t("shiftHistoryStaff")}</th>
              <th className="px-3 py-2 font-medium">{t("shiftNet")}</th>
              <th className="px-3 py-2 font-medium">{t("shiftExpensesLabel")}</th>
              <th className="px-3 py-2 font-medium">{t("shiftStatus")}</th>
              <th className="px-3 py-2 font-medium">{t("shiftHistoryDetails")}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id} className="border-t align-top">
                <td className="px-3 py-2 tabular-nums">{session.business_date ?? "—"}</td>
                <td className="px-3 py-2 font-medium">{session.shift?.name ?? t("unknownShift")}</td>
                <td className="px-3 py-2">{session.staff_on_duty?.name ?? session.opened_by?.name ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{moneyLabel(session.expected_net, "0.00")}</td>
                <td className="px-3 py-2 tabular-nums">{moneyLabel(session.expected_expenses, "0.00")}</td>
                <td className="px-3 py-2">{session.status}</td>
                <td className="px-3 py-2">
                  <details className="min-w-56">
                    <summary className="cursor-pointer text-primary underline-offset-4 hover:underline">
                      {t("shiftHistoryView")}
                    </summary>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-muted/40 p-2 text-xs">
                      <dt className="text-muted-foreground">{t("openingFloat")}</dt>
                      <dd className="tabular-nums">{moneyLabel(session.opening_float, "0.00")}</dd>
                      <dt className="text-muted-foreground">{t("expectedCash")}</dt>
                      <dd className="tabular-nums">{moneyLabel(session.expected_cash, "0.00")}</dd>
                      {/* Expected cash less the float: what this shift itself took. */}
                      <dt className="text-muted-foreground">{t("collectedCash")}</dt>
                      <dd className="tabular-nums">{moneyLabel(session.collected_cash, "—")}</dd>
                      <dt className="text-muted-foreground">{t("collectedTotal")}</dt>
                      <dd className="tabular-nums">{moneyLabel(session.collected_total, "—")}</dd>
                      <dt className="text-muted-foreground">{t("counted_cash")}</dt>
                      <dd className="tabular-nums">{moneyLabel(session.counted_cash, "—")}</dd>
                      <dt className="text-muted-foreground">{t("expectedCard")}</dt>
                      <dd className="tabular-nums">{moneyLabel(session.expected_card, "0.00")}</dd>
                      <dt className="text-muted-foreground">{t("counted_card")}</dt>
                      <dd className="tabular-nums">{moneyLabel(session.counted_card, "—")}</dd>
                      <dt className="text-muted-foreground">{t("expectedBank")}</dt>
                      <dd className="tabular-nums">{moneyLabel(session.expected_bank, "0.00")}</dd>
                      <dt className="text-muted-foreground">{t("counted_bank")}</dt>
                      <dd className="tabular-nums">{moneyLabel(session.counted_bank, "—")}</dd>
                    </dl>
                    {session.variance_notes ? (
                      <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs">
                        <span className="font-medium">{t("varianceNotes")}: </span>
                        {session.variance_notes}
                      </p>
                    ) : null}
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Hand the live drawer to a replacement without closing the shift. */
function AssignStaffControl({
  currentStaffId,
  pending,
  sessionId,
  staff,
  onAssign,
}: {
  currentStaffId: number | null;
  pending: boolean;
  sessionId: number;
  staff: ShiftDeskStaff[];
  onAssign: (action: () => Promise<{ ok: boolean; message: string }>) => void;
}) {
  const t = useTranslations("Dashboard.finance");
  const [employeeId, setEmployeeId] = useState(currentStaffId ? String(currentStaffId) : "");

  const selectedStaff = staff.find((employee) => String(employee.id) === employeeId);
  const selectedStaffLabel = selectedStaff
    ? selectedStaff.role
      ? `${selectedStaff.name} — ${selectedStaff.role}`
      : selectedStaff.name
    : undefined;

  if (staff.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div>
        <p className="font-medium text-sm">{t("replaceEarlyLeaveTitle")}</p>
        <p className="text-muted-foreground text-xs">{t("replaceEarlyLeaveHelp")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-muted-foreground text-xs" htmlFor={`assign-staff-${sessionId}`}>
          {t("replacementEmployee")}
        </Label>
        <Select value={employeeId} onValueChange={(next) => setEmployeeId(next ?? "")}>
          <SelectTrigger id={`assign-staff-${sessionId}`} className="h-8 w-56">
            <SelectValue placeholder={t("selectReplacement")}>{selectedStaffLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {staff.map((employee) => (
                <SelectItem key={employee.id} value={String(employee.id)}>
                  {employee.role ? `${employee.name} — ${employee.role}` : employee.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !employeeId || employeeId === String(currentStaffId ?? "")}
          onClick={() => onAssign(() => assignShiftStaff(sessionId, Number(employeeId)))}
        >
          {t("startCoverage")}
        </Button>
      </div>
      <span className="text-[11px] text-muted-foreground">{t("staffHandoffHelp")}</span>
    </div>
  );
}

/** Sessions are never created implicitly; assigned staff are listed first, with all active staff available. */
function OpenSessionForm({
  shifts,
  pending,
  onOpen,
}: {
  shifts: ShiftDeskShift[];
  pending: boolean;
  onOpen: (action: () => Promise<{ ok: boolean; message: string }>) => void;
}) {
  const t = useTranslations("Dashboard.finance");
  const [shiftId, setShiftId] = useState<string>(shifts[0] ? String(shifts[0].id) : "");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [openingFloat, setOpeningFloat] = useState("");

  const selectedShift = shifts.find((shift) => String(shift.id) === shiftId);
  const staff = selectedShift?.employees ?? [];

  // The API sorts this shift's own staff first, so falling back to the head of the
  // list names somebody actually assigned to the shift rather than whoever happens
  // to be signed in. Derived instead of stored so switching shifts cannot leave a
  // stale employee selected.
  const activeEmployeeId = staff.some((employee) => String(employee.id) === employeeId)
    ? employeeId
    : (staff[0] && String(staff[0].id)) || "";
  const selectedStaff = staff.find((employee) => String(employee.id) === activeEmployeeId);
  const selectedStaffLabel = selectedStaff
    ? selectedStaff.role
      ? `${selectedStaff.name} — ${selectedStaff.role}`
      : selectedStaff.name
    : undefined;

  if (shifts.length === 0) {
    return (
      <div className="grid gap-3 rounded-lg border border-dashed bg-muted/10 p-4 text-center">
        <p className="font-medium text-foreground text-sm">No active shifts are configured.</p>
        <p className="text-muted-foreground text-xs">Add a shift in settings before opening the desk.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-lg border border-dashed bg-muted/10 p-4">
      <div>
        <p className="font-medium text-foreground text-sm">{t("openDeskTitle")}</p>
        <p className="text-muted-foreground text-xs">{t("openDeskHelp")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="open-shift-id">{t("shift")}</Label>
          <Select
            value={shiftId}
            onValueChange={(next) => {
              setShiftId(next ?? "");
              setEmployeeId("");
            }}
          >
            <SelectTrigger id="open-shift-id" className="w-full">
              <span className="flex flex-1 text-start">{selectedShift?.name ?? t("selectShift")}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {shifts.map((shift) => (
                  <SelectItem key={shift.id} value={String(shift.id)}>
                    {shift.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="open-shift-staff">{t("staffOnDuty")}</Label>
          <Select value={activeEmployeeId} onValueChange={(next) => setEmployeeId(next ?? "")}>
            <SelectTrigger id="open-shift-staff" className="w-full" disabled={staff.length === 0}>
              <SelectValue placeholder={t("selectStaffOnDuty")}>{selectedStaffLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {staff.map((employee) => (
                  <SelectItem key={employee.id} value={String(employee.id)}>
                    {employee.role ? `${employee.name} — ${employee.role}` : employee.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {staff.length === 0 ? <p className="text-[11px] text-amber-600">{t("noStaffForShift")}</p> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="open-shift-float">{t("openingFloat")}</Label>
          <Input
            id="open-shift-float"
            type="number"
            min="0"
            step="0.01"
            value={openingFloat}
            placeholder={t("openingFloatPlaceholder")}
            onChange={(event) => setOpeningFloat(event.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">{t("openingFloatHelp")}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={pending || !shiftId || !activeEmployeeId}
          onClick={() =>
            onOpen(() =>
              openShiftSession({
                employee_shift_id: Number(shiftId),
                employee_id: Number(activeEmployeeId),
                // Leave blank to carry the previous shift's counted cash. The first
                // session of a new business day starts at zero.
                opening_float: openingFloat === "" ? undefined : openingFloat,
              }),
            )
          }
        >
          {t("openDeskAction")}
        </Button>
        <span className="text-[11px] text-muted-foreground">{t("laterShiftCarryHint")}</span>
      </div>
    </div>
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

/**
 * Every metric on the desk is a cash figure unless marked `plain`, so money
 * gating is the default here — a new metric is covered without anyone
 * remembering to opt it in.
 */
function Metric({ label, plain = false, value }: { label: string; plain?: boolean; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      {plain ? (
        <div className="font-medium tabular-nums">{value}</div>
      ) : (
        <Money domain="sales" className="block font-medium tabular-nums">
          {value}
        </Money>
      )}
    </div>
  );
}
