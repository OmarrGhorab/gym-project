"use client";

import { useActionState, useEffect } from "react";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { type AttendanceActionResult, reviewMemberVisit } from "./actions";

const initialState: AttendanceActionResult = { ok: true, message: "", errors: {}, values: {} };

export function MemberVisitReviewActions({ visitId }: { visitId: number }) {
  const t = useTranslations("Dashboard.attendance");
  const [state, action, pending] = useActionState(reviewMemberVisit, initialState);

  useEffect(() => {
    if (state.message) {
      (state.ok ? toast.success : toast.error)(state.message);
    }
  }, [state]);

  return (
    <form action={action} className="mt-2 flex gap-2">
      <input type="hidden" name="member_visit_id" value={visitId} />
      <Button type="submit" name="decision" value="approved" size="xs" disabled={pending}>
        {t("approveMemberVisit")}
      </Button>
      <Button type="submit" name="decision" value="dismissed" size="xs" variant="outline" disabled={pending}>
        {t("dismissMemberVisit")}
      </Button>
    </form>
  );
}
