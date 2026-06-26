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
import { Textarea } from "@/components/ui/textarea";
import type { AppLocale } from "@/i18n/routing";
import { createMemberVisit } from "@/lib/actions/attendance";
import { cn } from "@/lib/utils";

type MemberVisitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MemberVisitDialog({ open, onOpenChange }: MemberVisitDialogProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("AttendancePage");
  const isArabic = locale === "ar";
  const [memberId, setMemberId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    const result = z.object({
      member_id: z.string().regex(/^[1-9]\d*$/, t("memberVisitMemberValidation")),
      notes: z.string().max(2000, t("notesValidation")),
    }).safeParse({ member_id: memberId, notes });

    if (!result.success) {
      setFieldErrors(Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), [issue.message]])));
      toast.error(t("formError"));
      return;
    }

    setIsPending(true);
    try {
      const visit = await createMemberVisit(
        {
          member_id: Number(memberId),
          notes: notes.trim() || null,
        },
        locale as AppLocale
      );
      if (visit.status === "blocked") {
        toast.warning(visit.alert_reason ?? t("memberVisitBlocked"));
      } else {
        toast.success(t("memberVisitAllowed"));
      }
      setMemberId("");
      setNotes("");
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
      <DialogContent className={cn("max-w-md", isArabic && "rtl")}>
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>{t("memberVisitTitle")}</DialogTitle>
          <DialogDescription>{t("memberVisitDescription")}</DialogDescription>
        </DialogHeader>
        <form id="member-visit-form" onSubmit={handleSubmit} className="space-y-4">
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
            {t("memberVisitSubmit")}
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
