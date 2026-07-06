"use client";

import * as React from "react";
import { useActionState } from "react";

import { useRouter } from "next/navigation";

import { CalendarCheck, Dumbbell, FileText, Ruler, Utensils } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { FormDatePicker, FormSelect, FormTimePicker } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { StaffOption } from "./data";
import { createMemberReportItem, type MemberReportFormState, type MemberReportKind } from "./member-report-actions";

const actions: { kind: MemberReportKind; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: "progress", icon: Ruler },
  { kind: "workout", icon: Dumbbell },
  { kind: "nutrition", icon: Utensils },
  { kind: "booking", icon: CalendarCheck },
  { kind: "document", icon: FileText },
];

const initialReportFormState: MemberReportFormState = {
  errors: {},
  ok: false,
  values: {},
};

export function MemberReportControls({ memberId, staff }: { memberId: number; staff: StaffOption[] }) {
  const t = useTranslations("Dashboard.membersPage");
  const [openKind, setOpenKind] = React.useState<MemberReportKind | null>(null);
  const ActiveIcon = actions.find((action) => action.kind === openKind)?.icon ?? Ruler;

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
        {openKind ? (
          <MemberReportDialogContent
            key={openKind}
            kind={openKind}
            memberId={memberId}
            staff={staff}
            icon={ActiveIcon}
            onClose={() => setOpenKind(null)}
          />
        ) : null}
      </Dialog>
    </>
  );
}

function MemberReportDialogContent({
  kind,
  icon: Icon,
  memberId,
  onClose,
  staff,
}: {
  kind: MemberReportKind;
  icon: React.ComponentType<{ className?: string }>;
  memberId: number;
  onClose: () => void;
  staff: StaffOption[];
}) {
  const t = useTranslations("Dashboard.membersPage");
  const router = useRouter();
  const [state, submit, pending] = useActionState(createMemberReportItem.bind(null, memberId), initialReportFormState);
  const actionLabel = t(`reportAdd.${kind}`);

  React.useEffect(() => {
    if (!state.ok) {
      return;
    }

    toast.success(t("reportItemSaved"));
    onClose();
    router.refresh();
  }, [onClose, router, state.ok, t]);

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Icon className="size-5" />
          {actionLabel}
        </DialogTitle>
        <DialogDescription>{t("addReportItemDescription")}</DialogDescription>
      </DialogHeader>
      <form action={submit} className="grid gap-4">
        <input type="hidden" name="kind" value={kind} />
        {state.message ? (
          <div
            className={
              state.ok
                ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-600 text-sm"
                : "rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
            }
          >
            {state.message}
          </div>
        ) : null}
        {kind === "progress" ? <ProgressFields state={state} t={t} /> : null}
        {kind === "workout" ? <WorkoutFields state={state} staff={staff} t={t} /> : null}
        {kind === "nutrition" ? <NutritionFields state={state} staff={staff} t={t} /> : null}
        {kind === "booking" ? <BookingFields state={state} staff={staff} t={t} /> : null}
        {kind === "document" ? <DocumentFields state={state} t={t} /> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? t("saving") : t("saveChanges")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ProgressFields({ state, t }: FieldsProps & { state: MemberReportFormState }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DateField
        error={fieldError(state, "recorded_on")}
        label={t("recordedOn")}
        name="recorded_on"
        placeholder={t("selectDate")}
        required
      />
      <Field error={fieldError(state, "weight_kg")} label={t("weightKg")} name="weight_kg" type="number" step="0.01" />
      <Field
        error={fieldError(state, "body_fat_percent")}
        label={t("bodyFatPercent")}
        name="body_fat_percent"
        type="number"
        step="0.01"
      />
      <Field error={fieldError(state, "chest_cm")} label={t("chestCm")} name="chest_cm" type="number" step="0.01" />
      <Field error={fieldError(state, "waist_cm")} label={t("waistCm")} name="waist_cm" type="number" step="0.01" />
      <Field error={fieldError(state, "hips_cm")} label={t("hipsCm")} name="hips_cm" type="number" step="0.01" />
      <Field error={fieldError(state, "arms_cm")} label={t("armsCm")} name="arms_cm" type="number" step="0.01" />
      <Field error={fieldError(state, "thighs_cm")} label={t("thighsCm")} name="thighs_cm" type="number" step="0.01" />
      <TextField className="sm:col-span-2" error={fieldError(state, "notes")} label={t("notes")} name="notes" />
    </div>
  );
}

function WorkoutFields({ state, staff, t }: FieldsProps & { state: MemberReportFormState; staff: StaffOption[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field error={fieldError(state, "title")} label={t("title")} name="title" required />
      <CoachSelect error={fieldError(state, "coach_id")} label={t("coach")} name="coach_id" staff={staff} />
      <DateField
        error={fieldError(state, "starts_on")}
        label={t("startsOn")}
        name="starts_on"
        placeholder={t("selectDate")}
      />
      <DateField
        error={fieldError(state, "ends_on")}
        label={t("endsOn")}
        name="ends_on"
        placeholder={t("selectDate")}
      />
      <TextField
        className="sm:col-span-2"
        error={fieldError(state, "sessions")}
        label={t("sessions")}
        name="sessions"
      />
      <TextField className="sm:col-span-2" error={fieldError(state, "notes")} label={t("notes")} name="notes" />
    </div>
  );
}

function NutritionFields({ state, staff, t }: FieldsProps & { state: MemberReportFormState; staff: StaffOption[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field error={fieldError(state, "title")} label={t("title")} name="title" required />
      <CoachSelect error={fieldError(state, "coach_id")} label={t("coach")} name="coach_id" staff={staff} />
      <Field
        error={fieldError(state, "daily_calories")}
        label={t("dailyCalories")}
        name="daily_calories"
        type="number"
      />
      <Field error={fieldError(state, "protein_grams")} label={t("proteinGrams")} name="protein_grams" type="number" />
      <Field error={fieldError(state, "carbs_grams")} label={t("carbsGrams")} name="carbs_grams" type="number" />
      <Field error={fieldError(state, "fat_grams")} label={t("fatGrams")} name="fat_grams" type="number" />
      <TextField
        className="sm:col-span-2"
        error={fieldError(state, "supplements")}
        label={t("supplements")}
        name="supplements"
      />
      <TextField className="sm:col-span-2" error={fieldError(state, "notes")} label={t("notes")} name="notes" />
    </div>
  );
}

function BookingFields({ state, staff, t }: FieldsProps & { state: MemberReportFormState; staff: StaffOption[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field error={fieldError(state, "title")} label={t("title")} name="title" required />
      <CoachSelect error={fieldError(state, "coach_id")} label={t("coach")} name="coach_id" staff={staff} />
      <Field error={fieldError(state, "type")} label={t("type")} name="type" placeholder="session" />
      <DateTimeField
        className="sm:col-span-2"
        dateError={fieldError(state, "starts_at_date")}
        dateLabel={t("startsAt")}
        name="starts_at"
        placeholder={t("selectDate")}
        required
        timeError={fieldError(state, "starts_at_time")}
        timeLabel={t("time")}
      />
      <DateTimeField
        className="sm:col-span-2"
        dateError={fieldError(state, "ends_at_date")}
        dateLabel={t("endsAt")}
        name="ends_at"
        placeholder={t("selectDate")}
        timeError={fieldError(state, "ends_at_time")}
        timeLabel={t("time")}
      />
      <TextField className="sm:col-span-2" error={fieldError(state, "notes")} label={t("notes")} name="notes" />
    </div>
  );
}

function DocumentFields({ state, t }: FieldsProps & { state: MemberReportFormState }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field error={fieldError(state, "title")} label={t("title")} name="title" required />
      <Field error={fieldError(state, "type")} label={t("type")} name="type" required placeholder="waiver" />
      <DateField
        error={fieldError(state, "expires_on")}
        label={t("expiresOn")}
        name="expires_on"
        placeholder={t("selectDate")}
      />
      <Field error={fieldError(state, "document")} label={t("documentFile")} name="document" type="file" required />
      <TextField className="sm:col-span-2" error={fieldError(state, "notes")} label={t("notes")} name="notes" />
    </div>
  );
}

type FieldsProps = { t: (key: string) => string };

function CoachSelect({
  error,
  label,
  name,
  staff,
}: {
  error?: string;
  label: string;
  name: string;
  staff: StaffOption[];
}) {
  return (
    <div className="grid gap-2 text-sm">
      <Label htmlFor={name} className="font-medium">
        {label}
      </Label>
      <FormSelect
        id={name}
        name={name}
        placeholder={label}
        error={error}
        options={staff.map((employee) => ({
          value: String(employee.id),
          label: employee.role ? `${employee.name} - ${employee.role}` : employee.name,
        }))}
      />
    </div>
  );
}
function DateField({
  error,
  label,
  name,
  placeholder,
  required = false,
}: {
  error?: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2 text-sm">
      <Label htmlFor={name} className="font-medium">
        {label}
      </Label>
      <FormDatePicker id={name} name={name} placeholder={placeholder} required={required} error={error} />
    </div>
  );
}

function DateTimeField({
  className,
  dateError,
  dateLabel,
  name,
  placeholder,
  required = false,
  timeError,
  timeLabel,
}: {
  className?: string;
  dateError?: string;
  dateLabel: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  timeError?: string;
  timeLabel: string;
}) {
  return (
    <div className={`grid gap-2 text-sm ${className ?? ""}`}>
      <Label htmlFor={`${name}_date`} className="font-medium">
        {dateLabel}
      </Label>
      <div className="grid gap-2 lg:grid-cols-[minmax(13rem,1fr)_minmax(15rem,1fr)]">
        <FormDatePicker
          id={`${name}_date`}
          name={`${name}_date`}
          placeholder={placeholder}
          required={required}
          error={dateError}
        />
        <div className="grid gap-1">
          <Label htmlFor={`${name}_time-hour`} className="sr-only">
            {timeLabel}
          </Label>
          <FormTimePicker id={`${name}_time`} name={`${name}_time`} required={required} error={timeError} />
        </div>
      </div>
    </div>
  );
}
function Field(props: React.ComponentProps<typeof Input> & { error?: string; label: string; name: string }) {
  const { error, label, name, ...inputProps } = props;
  return (
    <div className="grid gap-2 text-sm">
      <Label htmlFor={name} className="font-medium">
        {label}
      </Label>
      <Input id={name} name={name} aria-invalid={Boolean(error)} {...inputProps} />
      <FieldError errors={error ? [{ message: error }] : undefined} />
    </div>
  );
}

function TextField({
  className,
  error,
  label,
  name,
}: {
  className?: string;
  error?: string;
  label: string;
  name: string;
}) {
  return (
    <div className={`grid gap-2 text-sm ${className ?? ""}`}>
      <Label htmlFor={name} className="font-medium">
        {label}
      </Label>
      <Textarea id={name} name={name} rows={3} aria-invalid={Boolean(error)} />
      <FieldError errors={error ? [{ message: error }] : undefined} />
    </div>
  );
}

function fieldError(state: MemberReportFormState, name: string) {
  return state.errors[name]?.[0];
}
