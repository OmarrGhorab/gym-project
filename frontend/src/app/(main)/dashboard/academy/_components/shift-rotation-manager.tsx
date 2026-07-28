"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { ArrowDown, ArrowUp, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveShiftOffRotation } from "../../settings/_components/actions";

type StaffEmployeeOption = {
  id: number;
  name: string;
};

const weekDaysOptions = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];

type OffRotationConfig = {
  id: number;
  off_weekday: number;
  rotation_start_date: string | null;
  employee_order: number[];
  is_active: boolean;
};

export function ShiftRotationManager({
  assignedEmployees,
  offDays = [],
  offRotation,
  shiftId,
  shiftName,
}: {
  assignedEmployees: StaffEmployeeOption[];
  offDays?: number[];
  offRotation?: OffRotationConfig | null;
  shiftId: number;
  shiftName: string;
}) {
  const t = useTranslations("Dashboard.academy");
  let initialOffDay = "5";
  if (offRotation) {
    initialOffDay = String(offRotation.off_weekday);
  } else if (offDays.length > 0) {
    initialOffDay = String(offDays[0]);
  }

  const initialStartDate = offRotation?.rotation_start_date ?? new Date().toISOString().slice(0, 10);

  const initialOrderedEmployees = useMemo(() => {
    if (!offRotation || offRotation.employee_order.length === 0) {
      return assignedEmployees;
    }

    const empMap = new Map(assignedEmployees.map((emp) => [emp.id, emp]));
    const ordered: StaffEmployeeOption[] = [];

    for (const empId of offRotation.employee_order) {
      const found = empMap.get(empId);
      if (found) {
        ordered.push(found);
        empMap.delete(empId);
      }
    }

    for (const remaining of empMap.values()) {
      ordered.push(remaining);
    }

    return ordered;
  }, [assignedEmployees, offRotation]);

  const [offWeekday, setOffWeekday] = useState(initialOffDay);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [orderedEmployees, setOrderedEmployees] = useState<StaffEmployeeOption[]>(initialOrderedEmployees);

  useEffect(() => {
    setOffWeekday(initialOffDay);
    setStartDate(initialStartDate);
    setOrderedEmployees(initialOrderedEmployees);
  }, [initialOffDay, initialStartDate, initialOrderedEmployees]);

  const [state, formAction, pending] = useActionState(saveShiftOffRotation, {
    errors: {},
    message: "",
    ok: true,
  });

  useEffect(() => {
    if (!state.ok && state.message) {
      toast.error(state.message);
    } else if (state.ok && state.message) {
      toast.success(state.message);
    }
  }, [state]);

  function moveUp(index: number) {
    if (index === 0) {
      return;
    }
    const next = [...orderedEmployees];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setOrderedEmployees(next);
  }

  function moveDown(index: number) {
    if (index === orderedEmployees.length - 1) {
      return;
    }
    const next = [...orderedEmployees];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setOrderedEmployees(next);
  }

  const primaryWeekday = Number(offWeekday);
  const isRotationActive = Boolean(offRotation?.is_active);
  let rotationSaveLabel = t("enableRotation");
  if (isRotationActive) {
    rotationSaveLabel = t("saveRotation");
  }
  if (pending) {
    rotationSaveLabel = t("rotationSaving");
  }
  const baseDate = startDate && !Number.isNaN(new Date(startDate).getTime()) ? new Date(startDate) : new Date();
  const currentDay = baseDate.getDay();
  const sunday = new Date(baseDate);
  sunday.setDate(baseDate.getDate() - currentDay);

  const preview = [];
  if (orderedEmployees.length > 0) {
    for (let week = 0; week < 4; week++) {
      const weekStart = new Date(sunday);
      weekStart.setDate(sunday.getDate() + week * 7);

      const offDate = new Date(weekStart);
      const targetOffset = (primaryWeekday - weekStart.getDay() + 7) % 7;
      offDate.setDate(weekStart.getDate() + targetOffset);

      const assignee = orderedEmployees[week % orderedEmployees.length];
      preview.push({
        assigneeName: assignee.name,
        dateLabel: new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", weekday: "short" }).format(
          offDate,
        ),
        weekNum: week + 1,
      });
    }
  }

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-xs">
      <input type="hidden" name="shift_id" value={shiftId} />
      {orderedEmployees.map((emp) => (
        <input key={emp.id} type="hidden" name="employee_order" value={emp.id} />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-2">
          <RotateCw className="size-3.5 text-primary" />
          <span className="font-semibold text-foreground text-xs uppercase tracking-wider">
            Custom Rotation Order & Sequence ({shiftName})
          </span>
        </div>
        <Badge
          variant="outline"
          className="border-emerald-500/30 font-normal text-[11px] text-emerald-600 dark:text-emerald-400"
        >
          Admin Configurable Order
        </Badge>
      </div>

      {assignedEmployees.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No staff assigned to this shift yet. Assign staff to this shift in the table above to enable custom rotation.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label className="text-xs">Off Weekday</Label>
              <FormSelect
                name="off_weekday"
                value={offWeekday}
                onValueChange={(val) => setOffWeekday(val)}
                options={weekDaysOptions}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`start-date-${shiftId}`} className="text-xs">
                Rotation Start Date
              </Label>
              <Input
                id={`start-date-${shiftId}`}
                name="rotation_start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <span className="font-medium text-muted-foreground text-xs">
              Reorder Sequence (Use ⬆️ ⬇️ to change who gets off first):
            </span>
            <div className="grid gap-1.5">
              {orderedEmployees.map((emp, idx) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between rounded-md border bg-background px-3 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="px-1.5 py-0 font-semibold text-[11px]">
                      #{idx + 1}
                    </Badge>
                    <span className="font-medium text-foreground text-xs">{emp.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-6 h-6"
                      disabled={idx === 0}
                      onClick={() => moveUp(idx)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-6 h-6"
                      disabled={idx === orderedEmployees.length - 1}
                      onClick={() => moveDown(idx)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-1 grid gap-1 border-t pt-2">
            <span className="font-medium text-[11px] text-muted-foreground">Calculated Schedule Preview:</span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {preview.map((p) => (
                <div key={p.weekNum} className="grid gap-0.5 rounded border bg-background p-1.5">
                  <span className="font-medium text-foreground">{p.dateLabel}</span>
                  <span className="truncate font-semibold text-emerald-600 dark:text-emerald-400">
                    {p.assigneeName} (OFF)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <div className="flex flex-wrap justify-end gap-2">
              {isRotationActive ? (
                <Button
                  type="submit"
                  name="is_active"
                  value="false"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  className="h-8 text-xs"
                >
                  {t("disableRotation")}
                </Button>
              ) : null}
              <Button
                type="submit"
                name="is_active"
                value="true"
                size="sm"
                disabled={pending}
                className="h-8 gap-1.5 text-xs"
              >
                {rotationSaveLabel}
              </Button>
            </div>
          </div>
        </>
      )}
    </form>
  );
}
