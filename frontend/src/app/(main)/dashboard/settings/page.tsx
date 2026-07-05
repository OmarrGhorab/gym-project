import type * as React from "react";

import { Clock3, MapPinned, Palette, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormTimePicker } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { deactivateShift, saveShift, updateSettings, updateViolationRule } from "./_components/actions";
import { getSettingsPageData } from "./_components/data";

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

      <form action={updateSettings} className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-normal">
              <Palette className="size-4" />
              {t("gymProfile")}
            </CardTitle>
            <CardDescription>{t("gymProfileDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label={t("gymName")} name="gym.name" defaultValue={settings.gym.name} />
            <Field label={t("currency")} name="currency" defaultValue={settings.currency} />
            <Field label={t("primaryColor")} name="gym.colors.primary" defaultValue={settings.gym.colors.primary} />
            <Field
              label={t("secondaryColor")}
              name="gym.colors.secondary"
              defaultValue={settings.gym.colors.secondary}
            />
            <Field label={t("reminderDays")} name="reminder_days" type="number" defaultValue={settings.reminder_days} />
            <Field label={t("vatRate")} name="vat_rate" type="number" step="0.01" defaultValue={settings.vat_rate} />
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="receipt_template">{t("receiptTemplate")}</Label>
              <Textarea id="receipt_template" name="receipt_template" defaultValue={settings.receipt_template} />
            </div>
          </CardContent>
        </Card>

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
            <Button type="submit" className="w-full">
              {t("saveSettings")}
            </Button>
          </CardContent>
        </Card>
      </form>

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
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium">{shift.name}</TableCell>
                    <TableCell>{formatShiftTimeRange(shift.starts_at, shift.ends_at)}</TableCell>
                    <TableCell>{t("minutesShort", { count: shift.grace_minutes })}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{shift.is_active ? t("active") : t("inactive")}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {shifts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      {t("noShifts")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <div className="mt-4 grid gap-3 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">{t("shiftFormHint")}</p>
              <form
                action={saveShift}
                className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-[minmax(10rem,1fr)_minmax(15rem,1.4fr)_minmax(15rem,1.4fr)_minmax(9rem,1fr)_minmax(6rem,auto)]"
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
                <Button type="submit" className="lg:col-span-2 2xl:col-span-5">
                  {t("createShift")}
                </Button>
              </form>
              {shifts.map((shift) => (
                <form
                  key={`edit-${shift.id}`}
                  action={saveShift}
                  className="grid gap-3 border-t pt-3 lg:grid-cols-2 2xl:grid-cols-[minmax(10rem,1fr)_minmax(15rem,1.4fr)_minmax(15rem,1.4fr)_minmax(9rem,1fr)_minmax(6rem,auto)_minmax(6rem,auto)]"
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
                    <Button formAction={deactivateShift} type="submit" size="sm" variant="outline" className="min-w-24">
                      {t("deactivate")}
                    </Button>
                  </div>
                </form>
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
                <form key={`rule-${rule.id}`} action={updateViolationRule} className="grid gap-3 rounded-lg border p-3">
                  <input type="hidden" name="id" value={rule.id} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label={t("ruleName")} name="name" defaultValue={rule.name} />
                    <Field
                      label={t("threshold")}
                      name="threshold_minutes"
                      type="number"
                      defaultValue={rule.threshold_minutes ?? ""}
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
                </form>
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
