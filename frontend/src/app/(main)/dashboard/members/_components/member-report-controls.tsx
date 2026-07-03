"use client";

import * as React from "react";
import { CalendarCheck, Dumbbell, FileText, Ruler, Utensils } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormDatePicker, FormTimePicker } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { createMemberReportItem, type MemberReportKind } from "./member-report-actions";

const actions: { kind: MemberReportKind; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: "progress", icon: Ruler },
  { kind: "workout", icon: Dumbbell },
  { kind: "nutrition", icon: Utensils },
  { kind: "booking", icon: CalendarCheck },
  { kind: "document", icon: FileText },
];

export function MemberReportControls({ memberId }: { memberId: number }) {
  const t = useTranslations("Dashboard.membersPage");
  const router = useRouter();
  const [openKind, setOpenKind] = React.useState<MemberReportKind | null>(null);
  const [pending, startTransition] = React.useTransition();
  const ActiveIcon = actions.find((action) => action.kind === openKind)?.icon ?? Ruler;

  function submit(formData: FormData) {
    if (!openKind) return;

    startTransition(async () => {
      try {
        await createMemberReportItem(memberId, openKind, formData);
        toast.success(t("reportItemSaved"));
        setOpenKind(null);
        router.refresh();
      } catch (error) {
        toast.error(t("pleaseTryAgain"), {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button key={action.kind} type="button" size="sm" variant="outline" onClick={() => setOpenKind(action.kind)}>
            <action.icon data-icon="inline-start" />
            {t(`reportAdd.${action.kind}`)}
          </Button>
        ))}
      </div>

      <Dialog open={openKind !== null} onOpenChange={(open) => !open && setOpenKind(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ActiveIcon className="size-5" />
              {openKind ? t(`reportAdd.${openKind}`) : t("addReportItem")}
            </DialogTitle>
            <DialogDescription>{t("addReportItemDescription")}</DialogDescription>
          </DialogHeader>
          <form action={submit} className="grid gap-4">
            {openKind === "progress" ? <ProgressFields t={t} /> : null}
            {openKind === "workout" ? <WorkoutFields t={t} /> : null}
            {openKind === "nutrition" ? <NutritionFields t={t} /> : null}
            {openKind === "booking" ? <BookingFields t={t} /> : null}
            {openKind === "document" ? <DocumentFields t={t} /> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenKind(null)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t("saving") : t("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProgressFields({ t }: FieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DateField label={t("recordedOn")} name="recorded_on" placeholder={t("selectDate")} required />
      <Field label={t("weightKg")} name="weight_kg" type="number" step="0.01" />
      <Field label={t("bodyFatPercent")} name="body_fat_percent" type="number" step="0.01" />
      <Field label={t("chestCm")} name="chest_cm" type="number" step="0.01" />
      <Field label={t("waistCm")} name="waist_cm" type="number" step="0.01" />
      <Field label={t("hipsCm")} name="hips_cm" type="number" step="0.01" />
      <Field label={t("armsCm")} name="arms_cm" type="number" step="0.01" />
      <Field label={t("thighsCm")} name="thighs_cm" type="number" step="0.01" />
      <TextField className="sm:col-span-2" label={t("notes")} name="notes" />
    </div>
  );
}

function WorkoutFields({ t }: FieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("title")} name="title" required />
      <Field label={t("coachId")} name="coach_id" type="number" />
      <DateField label={t("startsOn")} name="starts_on" placeholder={t("selectDate")} />
      <DateField label={t("endsOn")} name="ends_on" placeholder={t("selectDate")} />
      <TextField className="sm:col-span-2" label={t("sessions")} name="sessions" />
      <TextField className="sm:col-span-2" label={t("notes")} name="notes" />
    </div>
  );
}

function NutritionFields({ t }: FieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("title")} name="title" required />
      <Field label={t("coachId")} name="coach_id" type="number" />
      <Field label={t("dailyCalories")} name="daily_calories" type="number" />
      <Field label={t("proteinGrams")} name="protein_grams" type="number" />
      <Field label={t("carbsGrams")} name="carbs_grams" type="number" />
      <Field label={t("fatGrams")} name="fat_grams" type="number" />
      <TextField className="sm:col-span-2" label={t("supplements")} name="supplements" />
      <TextField className="sm:col-span-2" label={t("notes")} name="notes" />
    </div>
  );
}

function BookingFields({ t }: FieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("title")} name="title" required />
      <Field label={t("coachId")} name="coach_id" type="number" />
      <Field label={t("type")} name="type" placeholder="session" />
      <DateTimeField className="sm:col-span-2" dateLabel={t("startsAt")} name="starts_at" placeholder={t("selectDate")} required timeLabel={t("time")} />
      <DateTimeField className="sm:col-span-2" dateLabel={t("endsAt")} name="ends_at" placeholder={t("selectDate")} timeLabel={t("time")} />
      <TextField className="sm:col-span-2" label={t("notes")} name="notes" />
    </div>
  );
}

function DocumentFields({ t }: FieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("title")} name="title" required />
      <Field label={t("type")} name="type" required placeholder="waiver" />
      <DateField label={t("expiresOn")} name="expires_on" placeholder={t("selectDate")} />
      <Field label={t("filePath")} name="file_path" />
      <TextField className="sm:col-span-2" label={t("notes")} name="notes" />
    </div>
  );
}

type FieldsProps = { t: (key: string) => string };


function DateField({ label, name, placeholder, required = false }: { label: string; name: string; placeholder?: string; required?: boolean }) {
  return (
    <div className="grid gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <FormDatePicker name={name} placeholder={placeholder} required={required} />
    </div>
  );
}

function DateTimeField({
  className,
  dateLabel,
  name,
  placeholder,
  required = false,
  timeLabel,
}: {
  className?: string;
  dateLabel: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  timeLabel: string;
}) {
  return (
    <div className={`grid gap-2 text-sm ${className ?? ""}`}>
      <span className="font-medium">{dateLabel}</span>
      <div className="grid gap-2 lg:grid-cols-[minmax(13rem,1fr)_minmax(15rem,1fr)]">
        <FormDatePicker name={`${name}_date`} placeholder={placeholder} required={required} />
        <div className="grid gap-1">
          <span className="sr-only">{timeLabel}</span>
          <FormTimePicker name={`${name}_time`} required={required} />
        </div>
      </div>
    </div>
  );
}
function Field(props: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  const { label, name, ...inputProps } = props;
  return (
    <div className="grid gap-2 text-sm">
      <label htmlFor={name} className="font-medium">{label}</label>
      <Input id={name} name={name} {...inputProps} />
    </div>
  );
}

function TextField({ className, label, name }: { className?: string; label: string; name: string }) {
  return (
    <div className={`grid gap-2 text-sm ${className ?? ""}`}>
      <label htmlFor={name} className="font-medium">{label}</label>
      <Textarea id={name} name={name} rows={3} />
    </div>
  );
}





