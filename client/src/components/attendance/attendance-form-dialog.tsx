"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import { createAttendance, updateAttendance } from "@/lib/actions/attendance";
import type { Attendance } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type AttendanceFormDialogProps = {
  mode: "add" | "edit";
  attendance?: Attendance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type AttendanceFormState = {
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string;
  status: string;
  notes: string;
};

export function AttendanceFormDialog(props: AttendanceFormDialogProps) {
  const formKey = `${props.mode}-${props.attendance?.id ?? "new"}-${props.open ? "open" : "closed"}`;

  return <AttendanceFormDialogContent key={formKey} {...props} />;
}

function AttendanceFormDialogContent({
  mode,
  attendance,
  open,
  onOpenChange,
}: AttendanceFormDialogProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("AttendancePage");
  const isArabic = locale === "ar";
  const isEditing = mode === "edit";
  const [portalContainer, setPortalContainer] = React.useState<HTMLDivElement | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [form, setForm] = React.useState<AttendanceFormState>(() => ({
    employee_id: attendance?.employee_id ? String(attendance.employee_id) : "",
    date: attendance?.date ?? new Date().toISOString().slice(0, 10),
    check_in: attendance?.check_in ?? "",
    check_out: attendance?.check_out ?? "",
    status: attendance?.status ?? "present",
    notes: attendance?.notes ?? "",
  }));

  function updateForm<K extends keyof AttendanceFormState>(
    key: K,
    value: AttendanceFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setFieldErrors({});

    const validationErrors = validateAttendanceForm({
      form,
      messages: {
        employee: t("employeeValidation"),
        date: t("dateValidation"),
        time: t("timeValidation"),
        timeOrder: t("timeOrderValidation"),
        status: t("statusValidation"),
        notes: t("notesValidation"),
      },
    });

    if (Object.keys(validationErrors).length > 0) {
      setError(t("formError"));
      setFieldErrors(validationErrors);
      toast.error(t("formError"));
      setIsPending(false);
      return;
    }

    const payload = {
      employee_id: Number(form.employee_id),
      date: form.date,
      check_in: form.check_in || null,
      check_out: form.check_out || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    try {
      if (isEditing && attendance) {
        await updateAttendance(attendance.id, payload, locale as AppLocale);
      } else {
        await createAttendance(payload, locale as AppLocale);
      }
      toast.success(isEditing ? t("attendanceUpdatedSuccess") : t("attendanceCreatedSuccess"));
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      const parsedError = parseActionError(err);
      if (parsedError) {
        setError(parsedError.message);
        setFieldErrors(parsedError.details ?? {});
        toast.error(parsedError.message);
      } else {
        const message = err instanceof Error ? err.message : t("formError");
        setError(message);
        toast.error(message);
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={setPortalContainer} className={cn("max-w-xl", isArabic && "rtl")}>
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>{isEditing ? t("editAttendanceTitle") : t("addAttendanceTitle")}</DialogTitle>
          <DialogDescription>
            {isEditing ? t("editAttendanceDescription") : t("addAttendanceDescription")}
          </DialogDescription>
        </DialogHeader>

        <form id="attendance-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="employee_id" className={cn(isArabic && "justify-end")}>
                {t("formEmployee")} *
              </Label>
              <Input
                id="employee_id"
                inputMode="numeric"
                value={form.employee_id}
                onChange={(event) => updateForm("employee_id", event.target.value)}
                disabled={isPending}
                className={cn("h-9", isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.employee_id} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date" className={cn(isArabic && "justify-end")}>
                {t("formDate")} *
              </Label>
              <DatePicker
                id="date"
                value={form.date}
                onChange={(date) => updateForm("date", date ?? "")}
                placeholder={t("formDatePlaceholder")}
                locale={locale}
                portalContainer={portalContainer}
                disabled={isPending}
                className={cn(isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.date} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="check_in" className={cn(isArabic && "justify-end")}>
                {t("formCheckIn")}
              </Label>
              <Input
                id="check_in"
                type="time"
                value={form.check_in}
                onChange={(event) => updateForm("check_in", event.target.value)}
                disabled={isPending}
                className={cn("h-9", isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.check_in} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="check_out" className={cn(isArabic && "justify-end")}>
                {t("formCheckOut")}
              </Label>
              <Input
                id="check_out"
                type="time"
                value={form.check_out}
                onChange={(event) => updateForm("check_out", event.target.value)}
                disabled={isPending}
                className={cn("h-9", isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.check_out} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className={cn(isArabic && "block text-right")}>
                {t("formStatus")} *
              </Label>
              <Select
                value={form.status}
                onValueChange={(value) => updateForm("status", value ?? "present")}
                disabled={isPending}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
                  <SelectItem value="present">{t("statusPresent")}</SelectItem>
                  <SelectItem value="late">{t("statusLate")}</SelectItem>
                  <SelectItem value="absent">{t("statusAbsent")}</SelectItem>
                  <SelectItem value="excused">{t("statusExcused")}</SelectItem>
                </SelectContent>
              </Select>
              <FieldError messages={fieldErrors.status} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className={cn(isArabic && "justify-end")}>
              {t("formNotes")}
            </Label>
            <Textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
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
          <Button type="submit" form="attendance-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditing ? t("formSave") : t("formAdd")}
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

function validateAttendanceForm({
  form,
  messages,
}: {
  form: AttendanceFormState;
  messages: {
    employee: string;
    date: string;
    time: string;
    timeOrder: string;
    status: string;
    notes: string;
  };
}) {
  const timePattern = /^$|^([01]\d|2[0-3]):[0-5]\d$/;
  const schema = z.object({
    employee_id: z.string().regex(/^[1-9]\d*$/, messages.employee),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, messages.date),
    check_in: z.string().regex(timePattern, messages.time),
    check_out: z.string().regex(timePattern, messages.time),
    status: z.enum(["present", "absent", "late", "excused"], { message: messages.status }),
    notes: z.string().max(2000, messages.notes),
  }).refine(
    (value) => !value.check_in || !value.check_out || value.check_out >= value.check_in,
    { path: ["check_out"], message: messages.timeOrder }
  );

  const result = schema.safeParse(form);
  if (result.success) return {};

  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), [issue.message]])
  );
}

function parseActionError(
  err: unknown
): { message: string; details?: Record<string, string[]> } | null {
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
