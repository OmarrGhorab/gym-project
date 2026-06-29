import { Clock3, MapPinned, Palette, ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

      <form action={updateSettings} className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
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

        <Card className="xl:col-span-5">
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
                    <TableCell>
                      {shift.starts_at} - {shift.ends_at}
                    </TableCell>
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
              <form action={saveShift} className="grid gap-3 md:grid-cols-5">
                <input type="hidden" name="id" value="0" />
                <Input name="name" placeholder={t("shiftName")} required />
                <Input name="starts_at" type="time" required />
                <Input name="ends_at" type="time" required />
                <Input name="grace_minutes" type="number" min={0} defaultValue={settings.attendance.default_grace_minutes} />
                <label className="flex items-center gap-2 text-sm">
                  <input name="is_active" type="checkbox" defaultChecked />
                  {t("active")}
                </label>
                <Button type="submit" className="md:col-span-5">
                  {t("createShift")}
                </Button>
              </form>
              {shifts.map((shift) => (
                <form key={`edit-${shift.id}`} action={saveShift} className="grid gap-3 border-t pt-3 md:grid-cols-6">
                  <input type="hidden" name="id" value={shift.id} />
                  <Input name="name" defaultValue={shift.name} aria-label={t("shiftName")} />
                  <Input name="starts_at" type="time" defaultValue={shift.starts_at.slice(0, 5)} aria-label={t("startsAt")} />
                  <Input name="ends_at" type="time" defaultValue={shift.ends_at.slice(0, 5)} aria-label={t("endsAt")} />
                  <Input name="grace_minutes" type="number" min={0} defaultValue={shift.grace_minutes} aria-label={t("grace")} />
                  <label className="flex items-center gap-2 text-sm">
                    <input name="is_active" type="checkbox" defaultChecked={shift.is_active} />
                    {t("active")}
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">
                      {t("save")}
                    </Button>
                    <Button formAction={deactivateShift} type="submit" size="sm" variant="outline">
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
                    <Field label={t("deductionDays")} name="deduction_days" type="number" step="0.01" defaultValue={rule.deduction_days} />
                    <div className="flex flex-wrap items-center gap-4 pt-7 text-sm">
                      <label className="flex items-center gap-2">
                        <input name="requires_admin_approval" type="checkbox" defaultChecked={rule.requires_admin_approval} />
                        {t("requiresApproval")}
                      </label>
                      <label className="flex items-center gap-2">
                        <input name="auto_apply_if_unreviewed" type="checkbox" defaultChecked={rule.auto_apply_if_unreviewed} />
                        {t("autoApply")}
                      </label>
                      <label className="flex items-center gap-2">
                        <input name="is_active" type="checkbox" defaultChecked={rule.is_active} />
                        {t("active")}
                      </label>
                    </div>
                  </div>
                  <Textarea name="description" defaultValue={rule.description ?? ""} placeholder={t("ruleDescription")} />
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
