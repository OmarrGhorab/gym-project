"use client";

import { useActionState, useEffect } from "react";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

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

import { type AttendanceActionResult, type PendingVisitReview, reviewMemberVisit } from "./actions";

const initialState: AttendanceActionResult = { ok: true, message: "", errors: {}, values: {} };

/**
 * Asks the desk to approve or dismiss a duplicate scan, in the middle of the
 * screen, while the member is still standing there.
 *
 * The same decision is available on the visits table further down the page, but
 * a scan that needs a human is easy to miss as a row — especially at a busy
 * door, where the operator is looking at the member and not the screen.
 */
export function DuplicateVisitDialog({
  onResolved,
  review,
}: {
  onResolved: () => void;
  review: PendingVisitReview | null;
}) {
  const t = useTranslations("Dashboard.attendance");
  const [state, formAction, pending] = useActionState(reviewMemberVisit, initialState);

  useEffect(() => {
    if (!state.message) {
      return;
    }

    (state.ok ? toast.success : toast.error)(state.message);

    if (state.ok) {
      onResolved();
    }
  }, [state, onResolved]);

  return (
    // Closable on Escape. The visit stays pending and its row on the day sheet
    // keeps the same two buttons, so backing out loses nothing — and a visit
    // another desk already reviewed cannot trap this one behind a 422.
    <AlertDialog
      open={review !== null}
      onOpenChange={(next) => {
        if (!next) {
          onResolved();
        }
      }}
    >
      {/* Must carry the data-[size] prefix: a bare sm:max-w-lg is a different
          key to tailwind-merge, so the base sm:max-w-sm survives and wins on
          specificity, and member names wrap to shreds in a narrow box. */}
      <AlertDialogContent className="data-[size=default]:sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <TriangleAlert />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("duplicateScanTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{review?.reason ?? t("duplicateScanBody")}</AlertDialogDescription>
        </AlertDialogHeader>

        <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <Row label={t("duplicateScanMember")} value={review?.memberName ?? t("duplicateScanUnknownMember")} />
          {review?.planName ? <Row label={t("duplicateScanPlan")} value={review.planName} /> : null}
          {review?.sessionsRemaining !== null && review?.sessionsRemaining !== undefined ? (
            <Row label={t("duplicateScanSessionsRemaining")} value={String(review.sessionsRemaining)} />
          ) : null}
        </dl>

        <p className="text-muted-foreground text-xs">{t("duplicateScanBody")}</p>

        <form action={formAction}>
          {/* Keyed by the visit so a second duplicate cannot inherit the previous id. */}
          <input type="hidden" name="member_visit_id" value={review?.id ?? ""} />
          <AlertDialogFooter>
            <Button type="submit" name="decision" value="dismissed" variant="outline" disabled={pending}>
              {t("dismissMemberVisit")}
            </Button>
            <Button type="submit" name="decision" value="approved" disabled={pending}>
              {t("approveMemberVisit")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    // minmax(0,1fr) lets the value column shrink instead of forcing the label
    // into a sliver; break-words handles names that are one long unbroken token.
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="break-words text-right font-medium">{value}</dd>
    </div>
  );
}
