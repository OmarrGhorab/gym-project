"use client";

import { CircleCheck, CircleSlash, CircleX, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import type { ScanOutcome } from "./actions";
import { formatVisitDate, formatVisitTime, VisitDetailRow } from "./visit-panel-parts";

const TONES = {
  allowed: {
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    Icon: CircleCheck,
  },
  denied: {
    className: "bg-destructive/15 text-destructive",
    Icon: CircleX,
  },
  dismissed: {
    className: "bg-muted text-muted-foreground",
    Icon: CircleSlash,
  },
  flagged: {
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    Icon: TriangleAlert,
  },
} as const;

/**
 * What happened to the scan, in the middle of the screen while the member is
 * still at the desk.
 *
 * A toast was the wrong shape for this: it says pass or fail and then leaves,
 * and the operator's next question is always the same one — which plan, until
 * when, how many sessions left, or, when the door stays shut, why. All of it is
 * on the panel, and it stays until someone closes it.
 */
export function VisitOutcomeDialog({ onClose, outcome }: { onClose: () => void; outcome: ScanOutcome | null }) {
  const t = useTranslations("Dashboard.attendance");
  const tone = TONES[outcome?.kind ?? "allowed"];
  const sessions = formatSessions(outcome, t);

  return (
    <AlertDialog
      open={outcome !== null}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      {/* Must carry the data-[size] prefix: a bare sm:max-w-lg is a different
          key to tailwind-merge, so the base sm:max-w-sm survives and wins on
          specificity, and member names wrap to shreds in a narrow box. */}
      <AlertDialogContent className="data-[size=default]:sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogMedia className={tone.className}>
            <tone.Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>{t(`scanOutcome.${outcome?.kind ?? "allowed"}Title`)}</AlertDialogTitle>
          <AlertDialogDescription>{outcome?.reason ?? ""}</AlertDialogDescription>
        </AlertDialogHeader>

        <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <VisitDetailRow
            label={t("duplicateScanMember")}
            value={outcome?.memberName ?? t("duplicateScanUnknownMember")}
          />
          {outcome?.memberPhone ? <VisitDetailRow label={t("phoneLabel")} value={outcome.memberPhone} /> : null}
          {outcome?.planName ? <VisitDetailRow label={t("duplicateScanPlan")} value={outcome.planName} /> : null}
          {outcome?.planStatus ? (
            <VisitDetailRow label={t("status")} value={planStatusLabel(outcome.planStatus, t)} />
          ) : null}
          {outcome?.planStartDate ? (
            <VisitDetailRow label={t("planStartDate")} value={formatVisitDate(outcome.planStartDate)} />
          ) : null}
          {outcome?.planEndDate ? (
            <VisitDetailRow label={t("duplicateScanPlanEnds")} value={formatVisitDate(outcome.planEndDate)} />
          ) : null}
          {sessions ? <VisitDetailRow label={t("duplicateScanSessionsRemaining")} value={sessions} /> : null}
          {outcome?.addonName ? (
            <VisitDetailRow
              label={t("addon")}
              value={[
                outcome.addonName,
                outcome.addonSessionsRemaining === null
                  ? t("unlimitedSessions")
                  : t("sessionsRemaining", { count: outcome.addonSessionsRemaining }),
              ].join(" · ")}
            />
          ) : null}
          {typeof outcome?.visitsThisMonth === "number" ? (
            <VisitDetailRow label={t("duplicateScanVisitsThisMonth")} value={String(outcome.visitsThisMonth)} />
          ) : null}
          {outcome?.checkInAt ? (
            <VisitDetailRow label={t("checkIn")} value={formatVisitTime(outcome.checkInAt)} />
          ) : null}
        </dl>

        <AlertDialogFooter>
          <Button type="button" onClick={onClose}>
            {t("scanOutcome.close")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A status the API adds later must show through untranslated, not blow up the panel. */
function planStatusLabel(status: string, t: ReturnType<typeof useTranslations>) {
  const key = `subscriptionStatuses.${status}`;

  return t.has(key as never) ? t(key as never) : status;
}

/**
 * Paired with the total so "9" reads as 9 of 10 rather than 9 used. A limited
 * plan with no total recorded still shows what is left; an unlimited one says so
 * rather than showing nothing, which reads as a missing answer.
 */
function formatSessions(outcome: ScanOutcome | null, t: ReturnType<typeof useTranslations>) {
  if (!outcome?.planName) {
    return null;
  }

  if (outcome.sessionsRemaining === null) {
    return t("unlimitedSessions");
  }

  return typeof outcome.sessionsTotal === "number"
    ? `${outcome.sessionsRemaining} / ${outcome.sessionsTotal}`
    : String(outcome.sessionsRemaining);
}
