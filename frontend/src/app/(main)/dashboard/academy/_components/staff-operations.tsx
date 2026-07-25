import type * as React from "react";

import { Clock3 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect, FormTimePicker } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { deactivateShift, saveShift, updateSettings } from "../../settings/_components/actions";
import type { DashboardSettings, EmployeeShift } from "../../settings/_components/data";
import { SettingsActionButton, SettingsActionForm } from "../../settings/_components/settings-action-form";
import { ShiftRotationManager } from "./shift-rotation-manager";

type StaffEmployeeOption = {
  id: number;
  name: string;
  shift?: { id: number } | null;
};

export async function StaffOperations({
  employees = [],
  settings,
  shifts,
}: {
  employees?: StaffEmployeeOption[];
  settings: DashboardSettings;
  shifts: EmployeeShift[];
}) {
  const t = await getTranslations("Dashboard.settings");
  const payroll = settings.payroll ?? { default_pay_day: 30, schedule_mode: "fixed" as const };
  const payrollScheduleMode = payroll.schedule_mode;
  const payrollDefaultPayDay = payroll.default_pay_day;

  return (
    <div className="grid gap-4">
      <SettingsActionForm action={updateSettings} className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-normal">{t("payrollScheduling")}</CardTitle>
            <CardDescription>{t("payrollSchedulingDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="payroll.schedule_mode">{t("payrollScheduleMode")}</Label>
              <FormSelect
                id="payroll.schedule_mode"
                name="payroll.schedule_mode"
                defaultValue={payrollScheduleMode}
                options={[
                  { value: "fixed", label: t("payrollScheduleFixed") },
                  { value: "per_employee", label: t("payrollSchedulePerEmployee") },
                ]}
              />
            </div>
            <Field
              label={t("defaultPayDay")}
              name="payroll.default_pay_day"
              type="number"
              min={1}
              max={31}
              defaultValue={payrollDefaultPayDay}
            />
            <p className="text-muted-foreground text-xs">{t("payrollSchedulingHelp")}</p>
            <Button type="submit" className="w-full">
              {t("saveSettings")}
            </Button>
          </CardContent>
        </Card>
      </SettingsActionForm>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-normal">
            <Clock3 className="size-4" />
            {t("staffShifts")}
          </CardTitle>
          <CardDescription>{t("staffShiftsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("time")}</TableHead>
                <TableHead>{t("grace")}</TableHead>
                <TableHead>{t("offDays")}</TableHead>
                <TableHead>{t("offDayBonus")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">{shift.name}</TableCell>
                  <TableCell>{formatShiftTimeRange(shift.starts_at, shift.ends_at)}</TableCell>
                  <TableCell>{t("minutesShort", { count: shift.grace_minutes })}</TableCell>
                  <TableCell>{formatOffDays(shift.off_days, t)}</TableCell>
                  <TableCell>{shift.off_day_bonus_enabled ? `EGP ${shift.off_day_bonus_amount}` : t("none")}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{shift.is_active ? t("active") : t("inactive")}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {shifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {t("noShifts")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          <div className="mt-4 grid gap-3 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">{t("shiftFormHint")}</p>
            <SettingsActionForm
              action={saveShift}
              className="grid items-end gap-3 lg:grid-cols-2 2xl:grid-cols-[minmax(10rem,1fr)_minmax(16rem,1.25fr)_minmax(16rem,1.25fr)_minmax(8rem,.8fr)_minmax(5rem,auto)_minmax(7rem,auto)]"
            >
              <input type="hidden" name="id" value="0" />
              <CompactField label={t("shiftName")}>
                <Input name="name" placeholder={t("shiftName")} required />
              </CompactField>
              <CompactField label={t("startsAt")}>
                <FormTimePicker name="starts_at" required />
              </CompactField>
              <CompactField label={t("endsAt")}>
                <FormTimePicker name="ends_at" required />
              </CompactField>
              <CompactField label={t("graceMinutes")}>
                <Input
                  name="grace_minutes"
                  type="number"
                  min={0}
                  defaultValue={settings.attendance.default_grace_minutes}
                />
              </CompactField>
              <div className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted lg:self-end">
                <Checkbox id="new-shift-active" name="is_active" defaultChecked />
                <Label htmlFor="new-shift-active">{t("active")}</Label>
              </div>
              <div className="flex justify-end lg:col-span-2 2xl:col-span-1">
                <Button type="submit" className="min-w-24">
                  {t("createShift")}
                </Button>
              </div>
              <div className="lg:col-span-2 2xl:col-span-6">
                <ShiftPolicyFields offDays={[]} bonusEnabled={false} bonusAmount="0.00" t={t} />
              </div>
            </SettingsActionForm>

            {shifts.map((shift) => {
              const shiftEmployees = (employees ?? []).filter((emp) => emp.shift?.id === shift.id);

              return (
                <div key={`edit-container-${shift.id}`} className="grid gap-3 border-t pt-3">
                  <SettingsActionForm
                    key={`edit-${shift.id}`}
                    action={saveShift}
                    className="grid items-end gap-3 lg:grid-cols-2 2xl:grid-cols-[minmax(10rem,1fr)_minmax(16rem,1.25fr)_minmax(16rem,1.25fr)_minmax(8rem,.8fr)_minmax(5rem,auto)_minmax(7rem,auto)]"
                  >
                    <input type="hidden" name="id" value={shift.id} />
                    <CompactField label={t("shiftName")}>
                      <Input name="name" defaultValue={shift.name} />
                    </CompactField>
                    <CompactField label={t("startsAt")}>
                      <FormTimePicker name="starts_at" defaultValue={shift.starts_at.slice(0, 5)} />
                    </CompactField>
                    <CompactField label={t("endsAt")}>
                      <FormTimePicker name="ends_at" defaultValue={shift.ends_at.slice(0, 5)} />
                    </CompactField>
                    <CompactField label={t("graceMinutes")}>
                      <Input name="grace_minutes" type="number" min={0} defaultValue={shift.grace_minutes} />
                    </CompactField>
                    <div className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted lg:self-end">
                      <Checkbox id={`shift-${shift.id}-active`} name="is_active" defaultChecked={shift.is_active} />
                      <Label htmlFor={`shift-${shift.id}-active`}>{t("active")}</Label>
                    </div>
                    <div className="flex items-end justify-end gap-2 lg:self-end 2xl:justify-start">
                      <Button type="submit" size="sm" className="min-w-16">
                        {t("save")}
                      </Button>
                      <SettingsActionButton action={deactivateShift} formData={{ id: String(shift.id) }}>
                        {t("deactivate")}
                      </SettingsActionButton>
                    </div>
                    <div className="lg:col-span-2 2xl:col-span-6">
                      <ShiftPolicyFields
                        bonusEnabled={shift.off_day_bonus_enabled}
                        bonusAmount={shift.off_day_bonus_amount}
                        offDays={shift.off_days}
                        shiftId={shift.id}
                        t={t}
                      />
                    </div>
                  </SettingsActionForm>
                  <ShiftRotationManager
                    assignedEmployees={shiftEmployees}
                    offDays={shift.off_days}
                    offRotation={shift.off_rotation}
                    shiftId={shift.id}
                    shiftName={shift.name || `Shift #${shift.id}`}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CompactField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="grid min-w-0 gap-1">
      <div className="font-medium text-muted-foreground text-xs">{label}</div>
      {children}
    </div>
  );
}

/** Fixed weekly off days: 0=Sunday … 6=Saturday (matches backend Carbon / PHP weekday numbers). */
const weekDays = [
  { labelKey: "weekday0", value: 0 },
  { labelKey: "weekday1", value: 1 },
  { labelKey: "weekday2", value: 2 },
  { labelKey: "weekday3", value: 3 },
  { labelKey: "weekday4", value: 4 },
  { labelKey: "weekday5", value: 5 },
  { labelKey: "weekday6", value: 6 },
] as const;

function ShiftPolicyFields({
  bonusAmount,
  bonusEnabled,
  offDays,
  shiftId = "new",
  t,
}: {
  bonusAmount: string;
  bonusEnabled: boolean;
  offDays: number[];
  shiftId?: number | "new";
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-2 sm:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div className="font-medium text-muted-foreground text-xs">{t("offDays")}</div>
          <Badge
            variant="outline"
            className="border-blue-500/30 font-normal text-[11px] text-blue-600 dark:text-blue-400"
          >
            Supports Weekly Rotation & Fixed Off Days
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs">
          Select the weekly off-day(s) for this shift. Staff assigned to this shift automatically rotate taking this
          off-weekday week by week.
        </p>
        <div className="flex flex-wrap gap-2">
          {weekDays.map((day) => {
            const id = `shift-${shiftId}-off-day-${day.value}`;
            const selected = offDays.includes(day.value);

            return (
              <label
                key={day.value}
                htmlFor={id}
                className={cn(
                  "inline-flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 font-medium text-sm transition-colors",
                  "hover:bg-muted has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary has-[[data-checked]]:text-primary-foreground",
                )}
              >
                <Checkbox
                  id={id}
                  name="off_days"
                  value={String(day.value)}
                  defaultChecked={selected}
                  className="size-3.5"
                />
                <span>{t(day.labelKey)}</span>
              </label>
            );
          })}
        </div>
      </div>

      <CompactField label={t("offDayBonus")}>
        <div className="grid gap-2">
          <label
            htmlFor={`shift-${shiftId}-off-day-bonus-enabled`}
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
          >
            <Checkbox
              id={`shift-${shiftId}-off-day-bonus-enabled`}
              name="off_day_bonus_enabled"
              defaultChecked={bonusEnabled}
            />
            <span>{t("bonusIfAttendOffDay")}</span>
          </label>
          <Input name="off_day_bonus_amount" type="number" min={0} step="0.01" defaultValue={bonusAmount} />
        </div>
      </CompactField>
    </div>
  );
}

function formatOffDays(days: number[], t: Awaited<ReturnType<typeof getTranslations>>) {
  if (days.length === 0) {
    return t("none");
  }

  return weekDays
    .filter((day) => days.includes(day.value))
    .map((day) => t(day.labelKey))
    .join(", ");
}

function formatShiftTimeRange(startsAt: string, endsAt: string) {
  return `${formatShiftTime(startsAt)} - ${formatShiftTime(endsAt)}`;
}

function formatShiftTime(value: string) {
  const [hourValue, minuteValue = "0"] = value.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return value;
  }

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function Field({
  defaultValue,
  label,
  max,
  min,
  name,
  step,
  type = "text",
}: {
  defaultValue: number | string;
  label: string;
  max?: number;
  min?: number;
  name: string;
  step?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} step={step} min={min} max={max} defaultValue={defaultValue} />
    </div>
  );
}
