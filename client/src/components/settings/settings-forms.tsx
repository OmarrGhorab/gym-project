"use client";

import * as React from "react";
import { Clock3, Loader2, LocateFixed, LockKeyhole, Pencil, Plus, Power } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  changeOwnPassword,
  createEmployeeShift,
  deactivateEmployeeShift,
  updateEmployeeShift,
  updateAttendanceSettings,
  type EmployeeShiftData,
} from "@/lib/actions/settings";
import type { AppSettings, EmployeeShift } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type SettingsFormsProps = {
  settings: AppSettings | null;
  shifts: EmployeeShift[];
  canManageSettings: boolean;
};

type FieldErrors = Record<string, string[]>;

export function SettingsForms({
  settings,
  shifts,
  canManageSettings,
}: SettingsFormsProps) {
  const locale = useLocale();
  const t = useTranslations("SettingsPage");
  const isArabic = locale === "ar";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        {canManageSettings ? (
          <GymLocationForm settings={settings} isArabic={isArabic} locale={locale as AppLocale} />
        ) : (
          <Card className="border shadow-xs">
            <CardHeader>
              <CardTitle>{t("locationTitle")}</CardTitle>
              <CardDescription>{t("locationRestricted")}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <PasswordForm isArabic={isArabic} locale={locale as AppLocale} />
      </div>

      {canManageSettings ? (
        <ShiftManagement shifts={shifts} isArabic={isArabic} locale={locale as AppLocale} />
      ) : null}
    </div>
  );
}

function ShiftManagement({
  shifts,
  isArabic,
  locale,
}: {
  shifts: EmployeeShift[];
  isArabic: boolean;
  locale: AppLocale;
}) {
  const t = useTranslations("SettingsPage");
  const [editingShift, setEditingShift] = React.useState<EmployeeShift | null>(null);
  const [form, setForm] = React.useState<EmployeeShiftData>(() => emptyShiftForm());
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [isPending, startTransition] = React.useTransition();

  function updateField<K extends keyof EmployeeShiftData>(key: K, value: EmployeeShiftData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditingShift(null);
    setForm(emptyShiftForm());
    setFieldErrors({});
  }

  function editShift(shift: EmployeeShift) {
    setEditingShift(shift);
    setForm({
      name: shift.name,
      starts_at: shift.starts_at,
      ends_at: shift.ends_at,
      grace_minutes: String(shift.grace_minutes),
      is_active: shift.is_active,
    });
    setFieldErrors({});
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    startTransition(async () => {
      try {
        if (editingShift) {
          await updateEmployeeShift(editingShift.id, form, locale);
          toast.success(t("shiftUpdated"));
        } else {
          await createEmployeeShift(form, locale);
          toast.success(t("shiftCreated"));
        }
        resetForm();
      } catch (error) {
        const parsed = parseActionError(error);
        setFieldErrors(parsed.details);
        toast.error(parsed.message ?? t("formError"));
      }
    });
  }

  function onDeactivate(shift: EmployeeShift) {
    startTransition(async () => {
      try {
        await deactivateEmployeeShift(shift.id, locale);
        toast.success(t("shiftDeactivated"));
        if (editingShift?.id === shift.id) {
          resetForm();
        }
      } catch (error) {
        const parsed = parseActionError(error);
        toast.error(parsed.message ?? t("formError"));
      }
    });
  }

  return (
    <Card className="border shadow-xs">
      <CardHeader>
        <div className={cn("flex items-start gap-3", isArabic && "flex-row-reverse text-right")}>
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-600">
            <Clock3 className="size-4" />
          </div>
          <div className="min-w-0">
            <CardTitle>{t("shiftsTitle")}</CardTitle>
            <CardDescription>{t("shiftsDescription")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsField
              id="shift_name"
              label={t("shiftNameLabel")}
              error={fieldErrors.name}
              isArabic={isArabic}
            >
              <Input
                id="shift_name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder={t("shiftNamePlaceholder")}
                className={cn(isArabic && "text-right")}
              />
            </SettingsField>
            <SettingsField
              id="shift_grace"
              label={t("shiftGraceLabel")}
              error={fieldErrors.grace_minutes}
              isArabic={isArabic}
            >
              <Input
                id="shift_grace"
                inputMode="numeric"
                value={form.grace_minutes}
                onChange={(event) => updateField("grace_minutes", event.target.value)}
                className={cn(isArabic && "text-right")}
              />
            </SettingsField>
            <SettingsField
              id="shift_start"
              label={t("shiftStartLabel")}
              error={fieldErrors.starts_at}
              isArabic={isArabic}
            >
              <Input
                id="shift_start"
                type="time"
                value={form.starts_at}
                onChange={(event) => updateField("starts_at", event.target.value)}
                className={cn(isArabic && "text-right")}
              />
            </SettingsField>
            <SettingsField
              id="shift_end"
              label={t("shiftEndLabel")}
              error={fieldErrors.ends_at}
              isArabic={isArabic}
            >
              <Input
                id="shift_end"
                type="time"
                value={form.ends_at}
                onChange={(event) => updateField("ends_at", event.target.value)}
                className={cn(isArabic && "text-right")}
              />
            </SettingsField>
          </div>

          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors hover:bg-muted",
              isArabic && "flex-row-reverse justify-end"
            )}
          >
            <Checkbox
              checked={form.is_active}
              onCheckedChange={(value) => updateField("is_active", Boolean(value))}
            />
            {t("shiftActiveLabel")}
          </label>

          <div className={cn("flex flex-wrap gap-2", isArabic && "justify-end")}>
            {editingShift ? (
              <Button type="button" variant="outline" onClick={resetForm} disabled={isPending}>
                {t("shiftCancelEdit")}
              </Button>
            ) : null}
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {editingShift ? t("shiftSave") : t("shiftCreate")}
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          {shifts.length ? (
            shifts.map((shift) => (
              <div
                key={shift.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2",
                  isArabic && "text-right"
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground">{shift.name}</p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {shift.starts_at} - {shift.ends_at} · {t("shiftGraceMinutes", { count: shift.grace_minutes })}
                  </p>
                </div>
                <div className={cn("flex items-center gap-2", isArabic && "flex-row-reverse")}>
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-bold",
                      shift.is_active
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {shift.is_active ? t("shiftActive") : t("shiftInactive")}
                  </span>
                  <Button type="button" variant="outline" size="icon-sm" onClick={() => editShift(shift)} disabled={isPending}>
                    <Pencil className="size-3.5" />
                    <span className="sr-only">{t("shiftEdit")}</span>
                  </Button>
                  {shift.is_active ? (
                    <Button type="button" variant="destructive" size="icon-sm" onClick={() => onDeactivate(shift)} disabled={isPending}>
                      <Power className="size-3.5" />
                      <span className="sr-only">{t("shiftDeactivate")}</span>
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
              {t("shiftsEmpty")}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function GymLocationForm({
  settings,
  isArabic,
  locale,
}: {
  settings: AppSettings | null;
  isArabic: boolean;
  locale: AppLocale;
}) {
  const t = useTranslations("SettingsPage");
  const [isPending, startTransition] = React.useTransition();
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [form, setForm] = React.useState({
    gym_latitude: toInputValue(settings?.attendance.gym_latitude),
    gym_longitude: toInputValue(settings?.attendance.gym_longitude),
    gym_radius_meters: toInputValue(settings?.attendance.gym_radius_meters ?? 150),
    default_grace_minutes: toInputValue(settings?.attendance.default_grace_minutes ?? 15),
  });

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error(t("locationUnavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          gym_latitude: position.coords.latitude.toFixed(6),
          gym_longitude: position.coords.longitude.toFixed(6),
        }));
        toast.success(t("locationCaptured"));
      },
      () => toast.error(t("locationUnavailable")),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    startTransition(async () => {
      try {
        await updateAttendanceSettings(form, locale);
        toast.success(t("locationSaved"));
      } catch (error) {
        const parsed = parseActionError(error);
        setFieldErrors(parsed.details);
        toast.error(parsed.message ?? t("formError"));
      }
    });
  }

  return (
    <Card className="border shadow-xs">
      <CardHeader>
        <div className={cn("flex items-start gap-3", isArabic && "flex-row-reverse text-right")}>
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <LocateFixed className="size-4" />
          </div>
          <div className="min-w-0">
            <CardTitle>{t("locationTitle")}</CardTitle>
            <CardDescription>{t("locationDescription")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsField
              id="gym_latitude"
              label={t("latitudeLabel")}
              error={fieldErrors["attendance.gym_latitude"]}
              isArabic={isArabic}
            >
              <Input
                id="gym_latitude"
                inputMode="decimal"
                value={form.gym_latitude}
                onChange={(event) => updateField("gym_latitude", event.target.value)}
                placeholder="30.044400"
                className={cn(isArabic && "text-right")}
              />
            </SettingsField>
            <SettingsField
              id="gym_longitude"
              label={t("longitudeLabel")}
              error={fieldErrors["attendance.gym_longitude"]}
              isArabic={isArabic}
            >
              <Input
                id="gym_longitude"
                inputMode="decimal"
                value={form.gym_longitude}
                onChange={(event) => updateField("gym_longitude", event.target.value)}
                placeholder="31.235700"
                className={cn(isArabic && "text-right")}
              />
            </SettingsField>
            <SettingsField
              id="gym_radius_meters"
              label={t("radiusLabel")}
              error={fieldErrors["attendance.gym_radius_meters"]}
              isArabic={isArabic}
            >
              <Input
                id="gym_radius_meters"
                inputMode="numeric"
                value={form.gym_radius_meters}
                onChange={(event) => updateField("gym_radius_meters", event.target.value)}
                placeholder="100"
                className={cn(isArabic && "text-right")}
              />
            </SettingsField>
            <SettingsField
              id="default_grace_minutes"
              label={t("graceLabel")}
              error={fieldErrors["attendance.default_grace_minutes"]}
              isArabic={isArabic}
            >
              <Input
                id="default_grace_minutes"
                inputMode="numeric"
                value={form.default_grace_minutes}
                onChange={(event) => updateField("default_grace_minutes", event.target.value)}
                placeholder="15"
                className={cn(isArabic && "text-right")}
              />
            </SettingsField>
          </div>

          <div className={cn("flex flex-wrap gap-2", isArabic && "justify-end")}>
            <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={isPending}>
              <LocateFixed className="size-4" />
              {t("useCurrentLocation")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {t("saveLocation")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordForm({
  isArabic,
  locale,
}: {
  isArabic: boolean;
  locale: AppLocale;
}) {
  const t = useTranslations("SettingsPage");
  const [isPending, startTransition] = React.useTransition();
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [form, setForm] = React.useState({
    current_password: "",
    password: "",
    password_confirmation: "",
  });

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    startTransition(async () => {
      if (form.password !== form.password_confirmation) {
        setFieldErrors({ password_confirmation: [t("passwordMismatch")] });
        return;
      }

      try {
        await changeOwnPassword(form, locale);
        setForm({ current_password: "", password: "", password_confirmation: "" });
        toast.success(t("passwordSaved"));
      } catch (error) {
        const parsed = parseActionError(error);
        setFieldErrors(parsed.details);
        toast.error(parsed.message ?? t("formError"));
      }
    });
  }

  return (
    <Card className="border shadow-xs">
      <CardHeader>
        <div className={cn("flex items-start gap-3", isArabic && "flex-row-reverse text-right")}>
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600">
            <LockKeyhole className="size-4" />
          </div>
          <div className="min-w-0">
            <CardTitle>{t("passwordTitle")}</CardTitle>
            <CardDescription>{t("passwordDescription")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <SettingsField
            id="current_password"
            label={t("currentPasswordLabel")}
            error={fieldErrors.current_password}
            isArabic={isArabic}
          >
            <Input
              id="current_password"
              type="password"
              autoComplete="current-password"
              value={form.current_password}
              onChange={(event) => updateField("current_password", event.target.value)}
              className={cn(isArabic && "text-right")}
            />
          </SettingsField>
          <SettingsField
            id="password"
            label={t("newPasswordLabel")}
            error={fieldErrors.password}
            isArabic={isArabic}
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              className={cn(isArabic && "text-right")}
            />
          </SettingsField>
          <SettingsField
            id="password_confirmation"
            label={t("confirmPasswordLabel")}
            error={fieldErrors.password_confirmation}
            isArabic={isArabic}
          >
            <Input
              id="password_confirmation"
              type="password"
              autoComplete="new-password"
              value={form.password_confirmation}
              onChange={(event) => updateField("password_confirmation", event.target.value)}
              className={cn(isArabic && "text-right")}
            />
          </SettingsField>

          <div className={cn("flex", isArabic && "justify-end")}>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {t("savePassword")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SettingsField({
  id,
  label,
  error,
  isArabic,
  children,
}: {
  id: string;
  label: string;
  error?: string[];
  isArabic: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={cn(isArabic && "justify-end")}>
        {label}
      </Label>
      {children}
      {error?.length ? (
        <p className={cn("text-xs font-semibold text-destructive", isArabic && "text-right")}>
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}

function parseActionError(error: unknown): {
  message: string | null;
  details: FieldErrors;
} {
  if (!(error instanceof Error)) {
    return { message: null, details: {} };
  }

  try {
    const parsed = JSON.parse(error.message) as {
      message?: string;
      details?: FieldErrors;
    };

    return {
      message: parsed.message ?? error.message,
      details: parsed.details ?? {},
    };
  } catch {
    return { message: error.message, details: {} };
  }
}

function toInputValue(value: number | string | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function emptyShiftForm(): EmployeeShiftData {
  return {
    name: "",
    starts_at: "09:00",
    ends_at: "17:00",
    grace_minutes: "15",
    is_active: true,
  };
}
