"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AppLocale } from "@/i18n/routing";
import { createMemberVisit, updateMemberVisit } from "@/lib/actions/attendance";
import type { MemberVisit } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type MemberVisitDialogProps = {
  mode?: "add" | "edit";
  visit?: MemberVisit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MemberVisitDialog(props: MemberVisitDialogProps) {
  const key = `${props.mode ?? "add"}-${props.visit?.id ?? "new"}-${props.open ? "open" : "closed"}`;

  return <MemberVisitDialogContent key={key} {...props} />;
}

function MemberVisitDialogContent({
  mode = "add",
  visit,
  open,
  onOpenChange,
}: MemberVisitDialogProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("AttendancePage");
  const isArabic = locale === "ar";
  const isEditing = mode === "edit" && Boolean(visit);
  const [memberId, setMemberId] = React.useState(visit?.member_id ? String(visit.member_id) : "");
  const [checkInAt, setCheckInAt] = React.useState(toDateTimeLocal(visit?.check_in_at));
  const [checkOutAt, setCheckOutAt] = React.useState(toDateTimeLocal(visit?.check_out_at));
  const [status, setStatus] = React.useState(visit?.status ?? "allowed");
  const [alertReason, setAlertReason] = React.useState(visit?.alert_reason ?? "");
  const [notes, setNotes] = React.useState(visit?.notes ?? "");
  const [isPending, setIsPending] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    const result = z.object({
      member_id: isEditing
        ? z.string().optional()
        : z.string().regex(/^[1-9]\d*$/, t("memberVisitMemberValidation")),
      check_in_at: isEditing
        ? z.string().regex(/^$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, t("dateValidation"))
        : z.string().optional(),
      check_out_at: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, t("dateValidation")),
      status: z.enum(["allowed", "blocked", "flagged"], { message: t("statusValidation") }),
      alert_reason: z.string().max(255, t("notesValidation")),
      notes: z.string().max(2000, t("notesValidation")),
    }).refine(
      (value) => !value.check_in_at || !value.check_out_at || value.check_out_at >= value.check_in_at,
      { path: ["check_out_at"], message: t("timeOrderValidation") }
    ).safeParse({
      member_id: memberId,
      check_in_at: checkInAt,
      check_out_at: checkOutAt,
      status,
      alert_reason: alertReason,
      notes,
    });

    if (!result.success) {
      setFieldErrors(Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), [issue.message]])));
      toast.error(t("formError"));
      return;
    }

    setIsPending(true);
    try {
      const savedVisit = isEditing && visit
        ? await updateMemberVisit(
            visit.id,
            {
              check_in_at: fromDateTimeLocal(checkInAt),
              check_out_at: fromDateTimeLocal(checkOutAt),
              status,
              alert_reason: alertReason.trim() || null,
              notes: notes.trim() || null,
            },
            locale as AppLocale
          )
        : await createMemberVisit(
            {
              member_id: Number(memberId),
              notes: notes.trim() || null,
            },
            locale as AppLocale
          );

      if (savedVisit.status === "blocked") {
        toast.warning(savedVisit.alert_reason ?? t("memberVisitBlocked"));
      } else {
        toast.success(isEditing ? t("memberVisitUpdatedSuccess") : t("memberVisitAllowed"));
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      const parsed = parseActionError(err);
      setFieldErrors(parsed?.details ?? {});
      toast.error(parsed?.message ?? (err instanceof Error ? err.message : t("formError")));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-lg", isArabic && "rtl")}>
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>{isEditing ? t("memberVisitEditTitle") : t("memberVisitTitle")}</DialogTitle>
          <DialogDescription>
            {isEditing ? t("memberVisitEditDescription") : t("memberVisitDescription")}
          </DialogDescription>
        </DialogHeader>
        <form id="member-visit-form" onSubmit={handleSubmit} className="space-y-4">
          {!isEditing ? (
            <div className="space-y-1.5">
              <Label htmlFor="member_visit_member_id" className={cn(isArabic && "justify-end")}>
                {t("memberVisitMemberId")}
              </Label>
              <Input
                id="member_visit_member_id"
                inputMode="numeric"
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
                disabled={isPending}
                className={cn("h-9", isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.member_id} />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="member_visit_check_in" className={cn(isArabic && "justify-end")}>
                  {t("memberVisitTableCheckIn")}
                </Label>
                <Input
                  id="member_visit_check_in"
                  type="datetime-local"
                  value={checkInAt}
                  onChange={(event) => setCheckInAt(event.target.value)}
                  disabled={isPending}
                  className={cn("h-9", isArabic && "text-right")}
                />
                <FieldError messages={fieldErrors.check_in_at} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="member_visit_check_out" className={cn(isArabic && "justify-end")}>
                  {t("memberVisitTableCheckOut")}
                </Label>
                <Input
                  id="member_visit_check_out"
                  type="datetime-local"
                  value={checkOutAt}
                  onChange={(event) => setCheckOutAt(event.target.value)}
                  disabled={isPending}
                  className={cn("h-9", isArabic && "text-right")}
                />
                <FieldError messages={fieldErrors.check_out_at} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className={cn(isArabic && "justify-end")}>{t("memberVisitTableStatus")}</Label>
                <Select value={status} onValueChange={(value) => value && setStatus(value)} disabled={isPending}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
                    <SelectItem value="allowed">{t("memberVisitStatusAllowed")}</SelectItem>
                    <SelectItem value="blocked">{t("memberVisitStatusBlocked")}</SelectItem>
                    <SelectItem value="flagged">{t("memberVisitStatusFlagged")}</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError messages={fieldErrors.status} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="member_visit_alert" className={cn(isArabic && "justify-end")}>
                  {t("memberVisitTableAlert")}
                </Label>
                <Input
                  id="member_visit_alert"
                  value={alertReason}
                  onChange={(event) => setAlertReason(event.target.value)}
                  disabled={isPending}
                  className={cn("h-9", isArabic && "text-right")}
                />
                <FieldError messages={fieldErrors.alert_reason} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="member_visit_notes" className={cn(isArabic && "justify-end")}>
              {t("formNotes")}
            </Label>
            <Textarea
              id="member_visit_notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isPending}
              className={cn("resize-none", isArabic && "text-right")}
            />
            <FieldError messages={fieldErrors.notes} />
          </div>
        </form>
        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("formCancel")}
          </Button>
          <Button type="submit" form="member-visit-form" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isEditing ? t("formSave") : t("memberVisitSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;

  return <p className="text-xs font-medium text-destructive">{messages[0]}</p>;
}

function parseActionError(err: unknown): { message: string; details?: Record<string, string[]> } | null {
  if (!(err instanceof Error)) return null;
  try {
    const parsed = JSON.parse(err.message) as {
      message?: string;
      details?: Record<string, string[]>;
    };
    return parsed.message ? { message: parsed.message, details: parsed.details } : null;
  } catch {
    return null;
  }
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
