"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarCheck, Dumbbell, FileText, Plus, Ruler, Utensils } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import {
  createMemberBooking,
  createMemberDocument,
  createMemberNutritionPlan,
  createMemberProgress,
  createMemberWorkoutPlan,
} from "@/lib/actions/member-report";
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
import { cn } from "@/lib/utils";

type ReportFormKind = "progress" | "workout" | "nutrition" | "document" | "booking";

type MemberReportControlsProps = {
  memberId: number;
};

const formOptions: { kind: ReportFormKind; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: "progress", icon: Ruler },
  { kind: "workout", icon: Dumbbell },
  { kind: "nutrition", icon: Utensils },
  { kind: "booking", icon: CalendarCheck },
  { kind: "document", icon: FileText },
];

export function MemberReportControls({ memberId }: MemberReportControlsProps) {
  const t = useTranslations("MembersPage");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const isArabic = locale === "ar";
  const [openKind, setOpenKind] = React.useState<ReportFormKind | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openKind) return;

    const formData = new FormData(event.currentTarget);
    const payload = buildPayload(openKind, formData);

    setIsPending(true);
    setError(null);

    try {
      await submitReportItem(openKind, memberId, payload, locale);
      toast.success(t("reportItemSaved"));
      setOpenKind(null);
      router.refresh();
    } catch (err) {
      const message = parseActionError(err) ?? t("formError");
      setError(message);
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  }

  const activeIcon = openKind ? formOptions.find((option) => option.kind === openKind)?.icon : Plus;
  const ActiveIcon = activeIcon ?? Plus;

  return (
    <>
      <div className={cn("flex flex-wrap gap-2", isArabic && "justify-end")}>
        {formOptions.map((option) => (
          <Button
            key={option.kind}
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 rounded-md"
            onClick={() => setOpenKind(option.kind)}
          >
            <option.icon className="size-4" />
            {t(`reportAdd_${option.kind}`)}
          </Button>
        ))}
      </div>

      <Dialog open={openKind !== null} onOpenChange={(open) => !open && setOpenKind(null)}>
        <DialogContent className={cn("max-w-2xl", isArabic && "rtl")}>
          <DialogHeader className={cn(isArabic && "text-right")}>
            <DialogTitle className="flex items-center gap-2">
              <ActiveIcon className="size-5 text-primary" />
              {openKind ? t(`reportAdd_${openKind}`) : t("reportAddItem")}
            </DialogTitle>
            <DialogDescription>{t("reportAddDescription")}</DialogDescription>
          </DialogHeader>

          <form id="member-report-form" onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {openKind === "progress" && <ProgressFields t={t} isArabic={isArabic} />}
            {openKind === "workout" && <WorkoutFields t={t} isArabic={isArabic} />}
            {openKind === "nutrition" && <NutritionFields t={t} isArabic={isArabic} />}
            {openKind === "document" && <DocumentFields t={t} isArabic={isArabic} />}
            {openKind === "booking" && <BookingFields t={t} isArabic={isArabic} />}
          </form>

          <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
            <Button type="button" variant="outline" onClick={() => setOpenKind(null)} disabled={isPending}>
              {t("formCancel")}
            </Button>
            <Button type="submit" form="member-report-form" disabled={isPending}>
              {isPending ? t("formSaving") : t("formSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProgressFields({ t, isArabic }: FieldProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="recorded_on" label={t("reportRecordedOn")} type="date" required isArabic={isArabic} />
      <Field name="weight_kg" label={t("reportLatestWeight")} type="number" step="0.01" isArabic={isArabic} />
      <Field name="body_fat_percent" label={t("reportLatestBodyFat")} type="number" step="0.01" isArabic={isArabic} />
      <Field name="chest_cm" label={t("reportChest")} type="number" step="0.01" isArabic={isArabic} />
      <Field name="waist_cm" label={t("reportWaist")} type="number" step="0.01" isArabic={isArabic} />
      <Field name="hips_cm" label={t("reportHips")} type="number" step="0.01" isArabic={isArabic} />
      <Field name="arms_cm" label={t("reportArms")} type="number" step="0.01" isArabic={isArabic} />
      <Field name="thighs_cm" label={t("reportThighs")} type="number" step="0.01" isArabic={isArabic} />
      <TextAreaField name="notes" label={t("formNotes")} isArabic={isArabic} className="sm:col-span-2" />
    </div>
  );
}

function WorkoutFields({ t, isArabic }: FieldProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="title" label={t("reportPlanTitle")} required isArabic={isArabic} />
      <Field name="coach_id" label={t("reportCoachId")} type="number" isArabic={isArabic} />
      <Field name="starts_on" label={t("reportStartsOn")} type="date" isArabic={isArabic} />
      <Field name="ends_on" label={t("reportEndsOn")} type="date" isArabic={isArabic} />
      <SelectField name="status" label={t("historyStatus")} isArabic={isArabic} options={["active", "paused", "completed"]} />
      <TextAreaField name="sessions" label={t("reportSessions")} isArabic={isArabic} placeholder={t("reportSessionsPlaceholder")} className="sm:col-span-2" />
      <TextAreaField name="notes" label={t("formNotes")} isArabic={isArabic} className="sm:col-span-2" />
    </div>
  );
}

function NutritionFields({ t, isArabic }: FieldProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="title" label={t("reportPlanTitle")} required isArabic={isArabic} />
      <Field name="coach_id" label={t("reportCoachId")} type="number" isArabic={isArabic} />
      <Field name="daily_calories" label={t("reportCalories")} type="number" isArabic={isArabic} />
      <Field name="protein_grams" label={t("reportProtein")} type="number" isArabic={isArabic} />
      <Field name="carbs_grams" label={t("reportCarbs")} type="number" isArabic={isArabic} />
      <Field name="fat_grams" label={t("reportFat")} type="number" isArabic={isArabic} />
      <SelectField name="status" label={t("historyStatus")} isArabic={isArabic} options={["active", "paused", "completed"]} />
      <TextAreaField name="supplements" label={t("reportSupplements")} isArabic={isArabic} className="sm:col-span-2" />
      <TextAreaField name="notes" label={t("formNotes")} isArabic={isArabic} className="sm:col-span-2" />
    </div>
  );
}

function DocumentFields({ t, isArabic }: FieldProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="title" label={t("reportDocumentTitle")} required isArabic={isArabic} />
      <Field name="type" label={t("reportDocumentType")} required isArabic={isArabic} placeholder="waiver" />
      <Field name="expires_on" label={t("reportExpiresOn")} type="date" isArabic={isArabic} />
      <Field name="file_path" label={t("reportFilePath")} isArabic={isArabic} />
      <TextAreaField name="notes" label={t("formNotes")} isArabic={isArabic} className="sm:col-span-2" />
    </div>
  );
}

function BookingFields({ t, isArabic }: FieldProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="title" label={t("reportBookingTitle")} required isArabic={isArabic} />
      <Field name="coach_id" label={t("reportCoachId")} type="number" isArabic={isArabic} />
      <Field name="type" label={t("reportBookingType")} isArabic={isArabic} placeholder="session" />
      <Field name="starts_at" label={t("reportStartsAt")} type="datetime-local" required isArabic={isArabic} />
      <Field name="ends_at" label={t("reportEndsAt")} type="datetime-local" isArabic={isArabic} />
      <SelectField name="status" label={t("historyStatus")} isArabic={isArabic} options={["scheduled", "completed", "cancelled", "no_show"]} />
      <TextAreaField name="notes" label={t("formNotes")} isArabic={isArabic} className="sm:col-span-2" />
    </div>
  );
}

type FieldProps = {
  t: (key: string) => string;
  isArabic: boolean;
};

type InputFieldProps = React.ComponentProps<typeof Input> & {
  name: string;
  label: string;
  isArabic: boolean;
};

function Field({ name, label, isArabic, className, ...props }: InputFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name} className={cn(isArabic && "justify-end")}>{label}</Label>
      <Input id={name} name={name} className={cn(isArabic && "text-right")} {...props} />
    </div>
  );
}

function TextAreaField({ name, label, isArabic, className, placeholder }: { name: string; label: string; isArabic: boolean; className?: string; placeholder?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name} className={cn(isArabic && "justify-end")}>{label}</Label>
      <Textarea id={name} name={name} rows={3} placeholder={placeholder} className={cn("resize-none", isArabic && "text-right")} />
    </div>
  );
}

function SelectField({ name, label, options, isArabic }: { name: string; label: string; options: string[]; isArabic: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className={cn(isArabic && "justify-end")}>{label}</Label>
      <select id={name} name={name} className={cn("h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50", isArabic && "text-right")}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}

function buildPayload(kind: ReportFormKind, formData: FormData) {
  const base = compact(Object.fromEntries(formData.entries()));

  if (kind === "workout") {
    return { ...base, sessions: parseSessions(String(formData.get("sessions") ?? "")) };
  }

  return base;
}

function compact(input: Record<string, FormDataEntryValue>) {
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
      .filter(([, value]) => value !== "" && value !== null)
  );
}

function parseSessions(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((title) => ({ title }));
}

async function submitReportItem(kind: ReportFormKind, memberId: number, payload: Record<string, unknown>, locale: AppLocale) {
  switch (kind) {
    case "progress":
      return createMemberProgress(memberId, payload, locale);
    case "workout":
      return createMemberWorkoutPlan(memberId, payload, locale);
    case "nutrition":
      return createMemberNutritionPlan(memberId, payload, locale);
    case "document":
      return createMemberDocument(memberId, payload, locale);
    case "booking":
      return createMemberBooking(memberId, payload, locale);
  }
}

function parseActionError(err: unknown) {
  if (!(err instanceof Error)) return null;
  try {
    const parsed = JSON.parse(err.message) as { message?: string; details?: Record<string, string[]> };
    const detail = parsed.details ? Object.values(parsed.details).flat()[0] : undefined;
    return detail ?? parsed.message ?? err.message;
  } catch {
    return err.message;
  }
}
