import type * as React from "react";

import { Clock3 } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormTimePicker } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { deactivateShift, saveShift } from "../../settings/_components/actions";
import type { EmployeeShift } from "../../settings/_components/data";
import { SettingsActionButton, SettingsActionForm } from "../../settings/_components/settings-action-form";

type StaffEmployeeOption = {
  id: number;
  name: string;
  shift?: { id: number } | null;
};

export async function StaffOperations({
  employees = [],
  shifts,
}: {
  employees?: StaffEmployeeOption[];
  shifts: EmployeeShift[];
}) {
  const t = await getTranslations("Dashboard.settings");

  return (
    <div className="grid gap-4">
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
                <TableHead>{t("assignedStaff")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">{shift.name}</TableCell>
                  <TableCell>{(employees ?? []).filter((emp) => emp.shift?.id === shift.id).length}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{shift.is_active ? t("active") : t("inactive")}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {shifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
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
              className="grid items-end gap-3 sm:grid-cols-[minmax(12rem,1fr)_minmax(5rem,auto)_minmax(7rem,auto)]"
            >
              <input type="hidden" name="id" value="0" />
              <CompactField label={t("shiftName")}>
                <Input name="name" placeholder={t("shiftName")} required />
              </CompactField>
              <div className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted lg:self-end">
                <Checkbox id="new-shift-active" name="is_active" defaultChecked />
                <Label htmlFor="new-shift-active">{t("active")}</Label>
              </div>
              <div className="flex justify-end">
                <Button type="submit" className="min-w-24">
                  {t("createShift")}
                </Button>
              </div>
            </SettingsActionForm>

            {shifts.map((shift) => {
              return (
                <div key={`edit-container-${shift.id}`} className="grid gap-3 border-t pt-3">
                  <SettingsActionForm
                    key={`edit-${shift.id}`}
                    action={saveShift}
                    className="grid items-end gap-3 sm:grid-cols-[minmax(12rem,1fr)_minmax(5rem,auto)_minmax(7rem,auto)]"
                  >
                    <input type="hidden" name="id" value={shift.id} />
                    <CompactField label={t("shiftName")}>
                      <Input name="name" defaultValue={shift.name} />
                    </CompactField>
                    <div className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted lg:self-end">
                      <Checkbox id={`shift-${shift.id}-active`} name="is_active" defaultChecked={shift.is_active} />
                      <Label htmlFor={`shift-${shift.id}-active`}>{t("active")}</Label>
                    </div>
                    <div className="flex items-end justify-end gap-2">
                      <Button type="submit" size="sm" className="min-w-16">
                        {t("save")}
                      </Button>
                      <SettingsActionButton action={deactivateShift} formData={{ id: String(shift.id) }}>
                        {t("deactivate")}
                      </SettingsActionButton>
                    </div>
                  </SettingsActionForm>
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
