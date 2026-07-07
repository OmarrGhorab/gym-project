import type * as React from "react";

import { Clock3, MapPinned, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormTimePicker } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import {
  createViolationRule,
  deactivateShift,
  saveShift,
  updateSettings,
  updateViolationRule,
} from "./_components/actions";
import { getSettingsPageData } from "./_components/data";
import { SettingsActionButton, SettingsActionForm } from "./_components/settings-action-form";

export default async function Page() {
  const t = await getTranslations("Dashboard.settings");
  const { rules, settings, shifts } = await getSettingsPageData();
  const gpsReady =
    settings.attendance.gym_latitude !== null &&
    settings.attendance.gym_longitude !== null &&
    settings.attendance.gym_radius_meters > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <Badge variant="outline" className={gpsReady ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
          <MapPinned />
          {gpsReady ? t("gpsReady") : t("gpsMissing")}
        </Badge>
      </div>

      <SettingsActionForm action={updateSettings} className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-normal">
              <MapPinned className="size-4" />
              {t("attendanceGps")}
            </CardTitle>
            <CardDescription>{t("attendanceGpsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field
              label={t("latitude")}
              name="attendance.gym_latitude"
              type="number"
              step="0.000001"
              defaultValue={settings.attendance.gym_latitude ?? ""}
            />
            <Field
              label={t("longitude")}
              name="attendance.gym_longitude"
              type="number"
              step="0.000001"
              defaultValue={settings.attendance.gym_longitude ?? ""}
            />
            <Field
              label={t("radiusMeters")}
              name="attendance.gym_radius_meters"
              type="number"
              defaultValue={settings.attendance.gym_radius_meters}
            />
            <Field
              label={t("defaultGraceMinutes")}
              name="attendance.default_grace_minutes"
              type="number"
              defaultValue={settings.attendance.default_grace_minutes}
            />
            <Field label={t("reminderDays")} name="reminder_days" type="number" defaultValue={settings.reminder_days} />
            <Button type="submit" className="w-full">
              {t("saveSettings")}
            </Button>
          </CardContent>
        </Card>
      </SettingsActionForm>

      <div className="grid grid-cols-1 gap-4">
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
                    <TableCell>
                      {shift.off_day_bonus_enabled ? `EGP ${shift.off_day_bonus_amount}` : t("none")}
                    </TableCell>
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
                className="grid items-end gap-3 lg:grid-cols-2 2xl:grid-cols-[minmax(10rem,1fr)_minmax(16rem,1.25fr)_minmax(16rem,1.25fr)_minmax(8rem,.8fr)_minmax(14rem,1.15fr)_minmax(10rem,1fr)_minmax(5rem,auto)_minmax(7rem,auto)]"
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
                <ShiftPolicyFields offDays={[]} bonusEnabled={false} bonusAmount="0.00" t={t} />
                <div className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted lg:self-end">
                  <Checkbox id="new-shift-active" name="is_active" defaultChecked />
                  <Label htmlFor="new-shift-active">{t("active")}</Label>
                </div>
                <div className="flex justify-end lg:col-span-2 2xl:col-span-1">
                  <Button type="submit" className="min-w-24">
                    {t("createShift")}
                  </Button>
                </div>
              </SettingsActionForm>
              {shifts.map((shift) => (
                <SettingsActionForm
                  key={`edit-${shift.id}`}
                  action={saveShift}
                  className="grid items-end gap-3 border-t pt-3 lg:grid-cols-2 2xl:grid-cols-[minmax(10rem,1fr)_minmax(16rem,1.25fr)_minmax(16rem,1.25fr)_minmax(8rem,.8fr)_minmax(14rem,1.15fr)_minmax(10rem,1fr)_minmax(5rem,auto)_minmax(7rem,auto)]"
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
                  <ShiftPolicyFields
                    offDays={shift.off_days}
                    bonusEnabled={shift.off_day_bonus_enabled}
                    bonusAmount={shift.off_day_bonus_amount}
                    t={t}
                    shiftId={shift.id}
                  />
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
                </SettingsActionForm>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-normal">
              <ShieldAlert className="size-4" />
              {t("attendanceRules")}
            </CardTitle>
            <CardDescription>{t("attendanceRulesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">{t("createRule")}</p>
                <p className="text-muted-foreground text-xs">{t("createRuleDescription")}</p>
              </div>
              <SettingsActionForm
                action={createViolationRule}
                className="grid gap-3 rounded-md border bg-background p-3"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <RuleNameSelect defaultValue={attendanceRuleOptions[0]} label={t("ruleName")} />
                  <Field label={t("threshold")} name="threshold_minutes" type="number" defaultValue="" />
                  <Field
                    label={t("warningCount")}
                    name="warning_count_before_deduction"
                    type="number"
                    defaultValue="0"
                  />
                  <Field label={t("deductionDays")} name="deduction_days" type="number" step="0.01" defaultValue="0" />
                  <div className="flex flex-wrap items-center gap-4 pt-7 text-sm">
                    <div className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
                      <Checkbox id="new-rule-requires-approval" name="requires_admin_approval" defaultChecked />
                      <Label htmlFor="new-rule-requires-approval">{t("requiresApproval")}</Label>
                    </div>
                    <div className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
                      <Checkbox id="new-rule-auto-apply" name="auto_apply_if_unreviewed" defaultChecked />
                      <Label htmlFor="new-rule-auto-apply">{t("autoApply")}</Label>
                    </div>
                    <div className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
                      <Checkbox id="new-rule-active" name="is_active" defaultChecked />
                      <Label htmlFor="new-rule-active">{t("active")}</Label>
                    </div>
                  </div>
                </div>
                <Textarea name="description" placeholder={t("ruleDescription")} />
                <Button type="submit" size="sm" className="w-fit">
                  {t("createRule")}
                </Button>
              </SettingsActionForm>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("rule")}</TableHead>
                  <TableHead>{t("threshold")}</TableHead>
                  <TableHead>{t("deduction")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="font-medium">{rule.name}</div>
                      <div className="text-muted-foreground text-xs">{rule.code}</div>
                    </TableCell>
                    <TableCell>{t("minutesShort", { count: rule.threshold_minutes ?? 0 })}</TableCell>
                    <TableCell>{t("days", { count: rule.deduction_days })}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.is_active ? t("active") : t("inactive")}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      {t("noRules")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <div className="mt-4 grid gap-3">
              {rules.map((rule) => (
                <details key={`rule-${rule.id}`} className="group rounded-lg border bg-background">
                  <summary className="grid cursor-pointer list-none gap-3 rounded-lg p-3 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(12rem,1fr)_auto] md:items-center [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">{rule.name}</span>
                        <Badge variant="outline">{rule.is_active ? t("active") : t("inactive")}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
                        <span>
                          {t("threshold")}: {t("minutesShort", { count: rule.threshold_minutes ?? 0 })}
                        </span>
                        <span>
                          {t("warningCount")}: {rule.warning_count_before_deduction}
                        </span>
                        <span>
                          {t("deduction")}: {t("days", { count: rule.deduction_days })}
                        </span>
                      </div>
                    </div>
                    <span className="text-muted-foreground text-xs group-open:hidden">{t("show")}</span>
                    <span className="hidden text-muted-foreground text-xs group-open:inline">{t("hide")}</span>
                  </summary>
                  <SettingsActionForm action={updateViolationRule} className="grid gap-3 border-t p-3">
                    <input type="hidden" name="id" value={rule.id} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <RuleNameSelect defaultValue={rule.name} label={t("ruleName")} />
                      <Field
                        label={t("threshold")}
                        name="threshold_minutes"
                        type="number"
                        defaultValue={rule.threshold_minutes ?? ""}
                      />
                      <Field
                        label={t("warningCount")}
                        name="warning_count_before_deduction"
                        type="number"
                        defaultValue={rule.warning_count_before_deduction}
                      />
                      <Field
                        label={t("deductionDays")}
                        name="deduction_days"
                        type="number"
                        step="0.01"
                        defaultValue={rule.deduction_days}
                      />
                      <div className="flex flex-wrap items-center gap-4 pt-7 text-sm">
                        <div className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
                          <Checkbox
                            id={`rule-${rule.id}-requires-approval`}
                            name="requires_admin_approval"
                            defaultChecked={rule.requires_admin_approval}
                          />
                          <Label htmlFor={`rule-${rule.id}-requires-approval`}>{t("requiresApproval")}</Label>
                        </div>
                        <div className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
                          <Checkbox
                            id={`rule-${rule.id}-auto-apply`}
                            name="auto_apply_if_unreviewed"
                            defaultChecked={rule.auto_apply_if_unreviewed}
                          />
                          <Label htmlFor={`rule-${rule.id}-auto-apply`}>{t("autoApply")}</Label>
                        </div>
                        <div className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
                          <Checkbox id={`rule-${rule.id}-active`} name="is_active" defaultChecked={rule.is_active} />
                          <Label htmlFor={`rule-${rule.id}-active`}>{t("active")}</Label>
                        </div>
                      </div>
                    </div>
                    <Textarea
                      name="description"
                      defaultValue={rule.description ?? ""}
                      placeholder={t("ruleDescription")}
                    />
                    <Button type="submit" size="sm">
                      {t("saveRule")}
                    </Button>
                  </SettingsActionForm>
                </details>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
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

function RuleNameSelect({ defaultValue, label }: { defaultValue: string; label: string }) {
  const value = attendanceRuleOptions.includes(defaultValue as (typeof attendanceRuleOptions)[number])
    ? defaultValue
    : attendanceRuleOptions[0];

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select name="name" defaultValue={value}>
        <SelectTrigger>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false} collisionAvoidance={{ side: "none" }} side="bottom">
          <SelectGroup>
            {attendanceRuleOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

const weekDays = [
  { labelKey: "weekdays.sun", value: 0 },
  { labelKey: "weekdays.mon", value: 1 },
  { labelKey: "weekdays.tue", value: 2 },
  { labelKey: "weekdays.wed", value: 3 },
  { labelKey: "weekdays.thu", value: 4 },
  { labelKey: "weekdays.fri", value: 5 },
  { labelKey: "weekdays.sat", value: 6 },
] as const;

const attendanceRuleOptions = [
  "Late more than 15 minutes",
  "Late more than 30 minutes",
  "Late more than 60 minutes",
  "Absence without approval",
  "Leaving before shift end",
  "Attendance outside assigned shift",
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
    <>
      <CompactField label={t("offDays")}>
        <div className="flex min-h-9 flex-wrap gap-2 rounded-md border px-2 py-1.5">
          {weekDays.map((day) => {
            const id = `shift-${shiftId}-off-day-${day.value}`;

            return (
              <label className="flex cursor-pointer items-center gap-1 text-xs" htmlFor={id} key={day.value}>
                <Checkbox id={id} name="off_days" value={String(day.value)} checked={offDays.includes(day.value)} />
                <span>{t(day.labelKey)}</span>
              </label>
            );
          })}
        </div>
      </CompactField>
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
    </>
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
  name,
  step,
  type = "text",
}: {
  defaultValue: number | string;
  label: string;
  name: string;
  step?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} step={step} defaultValue={defaultValue} />
    </div>
  );
}
