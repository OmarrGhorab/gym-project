"use client";

import { type ReactNode, useActionState, useEffect, useState } from "react";

import { CalendarClock, Check, HandCoins, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { type AttendanceActionResult, createOvertimeShift, reviewOvertimeShift } from "./actions";
import type { EmployeeOption, EmployeeShift, OvertimeCandidate, OvertimeShiftRecord } from "./data";

const initialState: AttendanceActionResult = { ok: true, message: "", errors: {}, values: {} };

type Props = {
  canManageOvertime: boolean;
  candidates: OvertimeCandidate[];
  employees: EmployeeOption[];
  overtimeShifts: OvertimeShiftRecord[];
  selectedDate: string;
  shifts: EmployeeShift[];
};

export function OvertimeShiftsPanel({
  canManageOvertime,
  candidates,
  employees,
  overtimeShifts,
  selectedDate,
  shifts,
}: Props) {
  const t = useTranslations("Dashboard.attendance");
  const openSlots = candidates.filter((candidate) => !candidate.covered_by);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 font-normal">
              <CalendarClock className="size-4" />
              {t("overtimeTitle")}
            </CardTitle>
            <CardDescription>{t("overtimeDescription")}</CardDescription>
          </div>
          <Badge variant="outline" className="w-fit">
            {t("overtimeOpenSlots", { count: openSlots.length })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <section className="grid gap-2">
          <SectionHeading title={t("overtimeUncovered")} help={t("overtimeUncoveredHelp")} />
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("overtimeAbsentEmployee")}</TableHead>
                  <TableHead>{t("shiftLabel")}</TableHead>
                  <TableHead className="min-w-64">{t("overtimeCoveredBy")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => (
                  <ClaimRow
                    key={candidate.employee.id}
                    candidate={candidate}
                    canManageOvertime={canManageOvertime}
                    employees={employees}
                    selectedDate={selectedDate}
                  />
                ))}
                {candidates.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground text-sm" colSpan={4}>
                      {t("overtimeNoUncovered")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>

        {canManageOvertime ? (
          <section className="grid gap-2">
            <SectionHeading title={t("overtimeManualTitle")} help={t("overtimeManualHelp")} />
            <ManualAssignmentForm employees={employees} selectedDate={selectedDate} shifts={shifts} />
          </section>
        ) : (
          <p className="rounded-lg border border-dashed bg-muted/10 px-3 py-2 text-muted-foreground text-xs">
            {t("overtimeManageRestricted")}
          </p>
        )}

        <section className="grid gap-2">
          <SectionHeading title={t("overtimeRecords")} help={t("overtimeRecordsHelp")} />
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("employee")}</TableHead>
                  <TableHead>{t("overtimeCoveringFor")}</TableHead>
                  <TableHead>{t("shiftLabel")}</TableHead>
                  <TableHead>{t("overtimeHours")}</TableHead>
                  <TableHead>{t("overtimeBonus")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  {canManageOvertime ? <TableHead className="min-w-72 text-right">{t("actions")}</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {overtimeShifts.map((record) => (
                  <RecordRow canManageOvertime={canManageOvertime} key={record.id} record={record} />
                ))}
                {overtimeShifts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="h-24 text-center text-muted-foreground text-sm"
                      colSpan={canManageOvertime ? 7 : 6}
                    >
                      {t("overtimeNoRecords")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function SectionHeading({ help, title }: { help: string; title: string }) {
  return (
    <div className="space-y-0.5">
      <p className="font-medium text-sm">{title}</p>
      <p className="text-muted-foreground text-xs">{help}</p>
    </div>
  );
}

function ClaimRow({
  candidate,
  canManageOvertime,
  employees,
  selectedDate,
}: {
  candidate: OvertimeCandidate;
  canManageOvertime: boolean;
  employees: EmployeeOption[];
  selectedDate: string;
}) {
  const t = useTranslations("Dashboard.attendance");
  const [state, action, pending] = useActionState(createOvertimeShift, initialState);
  const [coveringEmployeeId, setCoveringEmployeeId] = useState("");
  const covered = candidate.covered_by;
  const formId = `overtime-claim-${candidate.employee.id}`;
  const options = employees
    .filter((employee) => employee.id !== candidate.employee.id)
    .map((employee) => ({
      key: `${formId}-${employee.id}`,
      label: `${employee.name} - ${employee.role}`,
      value: String(employee.id),
    }));

  useActionToast(state);

  useEffect(() => {
    if (state.ok && state.message) {
      setCoveringEmployeeId("");
    }
  }, [state]);

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{candidate.employee.name}</div>
        <div className="text-muted-foreground text-xs">{candidate.employee.role ?? t("staff")}</div>
      </TableCell>
      <TableCell>
        <div>{candidate.shift?.name ?? t("noShift")}</div>
        <div className="text-muted-foreground text-xs">
          {candidate.shift?.starts_at && candidate.shift?.ends_at
            ? `${candidate.shift.starts_at} - ${candidate.shift.ends_at}`
            : "--"}
        </div>
      </TableCell>
      <TableCell className="min-w-64">
        {covered ? (
          <div>
            <div className="font-medium">{covered.employee_name ?? `#${covered.employee_id}`}</div>
            <div className="text-muted-foreground text-xs">{t(`overtimeStatuses.${covered.status}`)}</div>
          </div>
        ) : null}
        {!covered && canManageOvertime ? (
          <form action={action} className="grid gap-1.5" id={formId}>
            <input name="covering_for_employee_id" type="hidden" value={candidate.employee.id} />
            <input name="date" type="hidden" value={selectedDate} />
            <input name="employee_shift_id" type="hidden" value={candidate.shift?.id ?? ""} />
            <input name="employee_id" type="hidden" value={coveringEmployeeId} />
            <Label className="text-muted-foreground text-xs" htmlFor={`${formId}-select`}>
              {t("overtimeSelectCover")}
            </Label>
            <FormSelect
              className="w-full"
              contentClassName="max-h-72"
              id={`${formId}-select`}
              name="employee_id_lookup"
              options={options}
              placeholder={t("selectEmployee")}
              searchPlaceholder={t("searchEmployees")}
              value={coveringEmployeeId}
              onValueChange={(value) => setCoveringEmployeeId(value ?? "")}
            />
          </form>
        ) : null}
      </TableCell>
      <TableCell className="text-right">
        {!covered && canManageOvertime ? (
          <Button disabled={pending || !coveringEmployeeId} form={formId} size="sm" type="submit">
            <HandCoins className="size-3.5" />
            {t("overtimeAssign")}
          </Button>
        ) : (
          <span className="text-muted-foreground text-xs">--</span>
        )}
      </TableCell>
    </TableRow>
  );
}

/**
 * Assign a replacement for anyone on the roster, not just the auto-detected absences.
 * Covers planned swaps and employees whose absence the schedule cannot infer. The API
 * still refuses to record a cover for someone who has already checked in.
 */
function ManualAssignmentForm({
  employees,
  selectedDate,
  shifts,
}: {
  employees: EmployeeOption[];
  selectedDate: string;
  shifts: EmployeeShift[];
}) {
  const t = useTranslations("Dashboard.attendance");
  const [state, action, pending] = useActionState(createOvertimeShift, initialState);
  const [coveringEmployeeId, setCoveringEmployeeId] = useState("");
  const [replacedEmployeeId, setReplacedEmployeeId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [date, setDate] = useState(selectedDate);

  useActionToast(state);

  useEffect(() => {
    setDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (state.ok && state.message) {
      setCoveringEmployeeId("");
      setReplacedEmployeeId("");
      setShiftId("");
    }
  }, [state]);

  const employeeOptions = (exclude: string) =>
    employees
      .filter((employee) => String(employee.id) !== exclude)
      .map((employee) => ({
        key: `manual-${exclude}-${employee.id}`,
        label: `${employee.name} - ${employee.role}`,
        value: String(employee.id),
      }));

  return (
    <form action={action} className="grid gap-3 rounded-lg border border-dashed bg-muted/10 p-4">
      <input name="employee_id" type="hidden" value={coveringEmployeeId} />
      <input name="covering_for_employee_id" type="hidden" value={replacedEmployeeId} />
      <input name="employee_shift_id" type="hidden" value={shiftId} />
      <input name="date" type="hidden" value={date} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-1.5">
          <Label className="text-xs" htmlFor="manual-overtime-cover">
            {t("overtimeSelectCover")}
          </Label>
          <FormSelect
            className="w-full"
            contentClassName="max-h-72"
            id="manual-overtime-cover"
            name="employee_id_lookup"
            options={employeeOptions(replacedEmployeeId)}
            placeholder={t("selectEmployee")}
            searchPlaceholder={t("searchEmployees")}
            value={coveringEmployeeId}
            onValueChange={(value) => setCoveringEmployeeId(value ?? "")}
          />
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs" htmlFor="manual-overtime-replaced">
            {t("overtimeReplacing")}
          </Label>
          <FormSelect
            className="w-full"
            contentClassName="max-h-72"
            id="manual-overtime-replaced"
            name="covering_for_employee_id_lookup"
            options={employeeOptions(coveringEmployeeId)}
            placeholder={t("selectEmployee")}
            searchPlaceholder={t("searchEmployees")}
            value={replacedEmployeeId}
            onValueChange={(value) => setReplacedEmployeeId(value ?? "")}
          />
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs" htmlFor="manual-overtime-shift">
            {t("shiftLabel")}
          </Label>
          <FormSelect
            className="w-full"
            contentClassName="max-h-72"
            id="manual-overtime-shift"
            name="employee_shift_id_lookup"
            options={shifts.map((shift) => ({
              key: `manual-shift-${shift.id}`,
              label: `${shift.name} (${shift.starts_at} - ${shift.ends_at})`,
              value: String(shift.id),
            }))}
            placeholder={t("overtimeShiftAuto")}
            searchPlaceholder={t("shiftLabel")}
            value={shiftId}
            onValueChange={(value) => setShiftId(value ?? "")}
          />
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs" htmlFor="manual-overtime-date">
            {t("attendanceDate")}
          </Label>
          <Input id="manual-overtime-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs" htmlFor="manual-overtime-notes">
          {t("notesLabel")}
        </Label>
        <Input id="manual-overtime-notes" name="notes" placeholder={t("notesPlaceholder")} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">{t("overtimeManualBonusHint")}</span>
        <Button disabled={pending || !coveringEmployeeId || !replacedEmployeeId} size="sm" type="submit">
          <HandCoins className="size-3.5" />
          {t("overtimeAssign")}
        </Button>
      </div>
    </form>
  );
}

function RecordRow({ canManageOvertime, record }: { canManageOvertime: boolean; record: OvertimeShiftRecord }) {
  const t = useTranslations("Dashboard.attendance");
  const [state, action, pending] = useActionState(reviewOvertimeShift, initialState);
  const [bonusAmount, setBonusAmount] = useState(record.bonus_amount === "0.00" ? "" : record.bonus_amount);

  useActionToast(state);

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{record.employee?.name ?? `#${record.employee_id}`}</div>
        <div className="text-muted-foreground text-xs">{record.date}</div>
      </TableCell>
      <TableCell>{record.covering_for?.name ?? "--"}</TableCell>
      <TableCell>
        <div>{record.shift?.name ?? t("noShift")}</div>
        <div className="text-muted-foreground text-xs">
          {record.starts_at && record.ends_at ? `${record.starts_at} - ${record.ends_at}` : "--"}
        </div>
      </TableCell>
      <TableCell>{record.hours ?? "--"}</TableCell>
      <TableCell className="tabular-nums">EGP {record.bonus_amount}</TableCell>
      <TableCell>
        <OvertimeStatusBadge status={record.status} />
      </TableCell>
      {canManageOvertime ? (
        <TableCell className="min-w-72">
          <form action={action} className="flex flex-wrap items-end justify-end gap-2">
            <input name="id" type="hidden" value={record.id} />
            {record.status === "settled" ? (
              <span className="text-muted-foreground text-xs">{t("overtimeSettledHelp")}</span>
            ) : (
              <>
                <div className="grid gap-1">
                  <Label className="text-muted-foreground text-xs" htmlFor={`overtime-bonus-${record.id}`}>
                    {t("overtimeBonusAmount")}
                  </Label>
                  <Input
                    className="h-8 w-28"
                    id={`overtime-bonus-${record.id}`}
                    min="0"
                    name="bonus_amount"
                    placeholder="0.00"
                    step="0.01"
                    type="number"
                    value={bonusAmount}
                    onChange={(event) => setBonusAmount(event.target.value)}
                  />
                </div>
                {/* The decision travels as the submit button's own value, so one form serves every action. */}
                <DecisionButton
                  decision="approved"
                  disabled={pending || bonusAmount.trim() === ""}
                  icon={<Check className="size-3.5" />}
                  label={record.status === "approved" ? t("overtimeUpdateBonus") : t("approve")}
                  variant="default"
                />
                {record.status === "approved" ? (
                  <DecisionButton
                    decision="settled"
                    disabled={pending}
                    icon={<HandCoins className="size-3.5" />}
                    label={t("overtimeMarkSettled")}
                    variant="outline"
                  />
                ) : null}
                <DecisionButton
                  decision="rejected"
                  disabled={pending}
                  icon={<X className="size-3.5" />}
                  label={t("dismiss")}
                  variant="outline"
                />
              </>
            )}
          </form>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function DecisionButton({
  decision,
  disabled,
  icon,
  label,
  variant,
}: {
  decision: "approved" | "rejected" | "settled";
  disabled: boolean;
  icon: ReactNode;
  label: string;
  variant: "default" | "outline";
}) {
  return (
    <Button disabled={disabled} name="decision" size="sm" type="submit" value={decision} variant={variant}>
      {icon}
      {label}
    </Button>
  );
}

function OvertimeStatusBadge({ status }: { status: string }) {
  const t = useTranslations("Dashboard.attendance");
  let variant: "default" | "outline" | "secondary" = "default";

  if (status === "pending") {
    variant = "secondary";
  } else if (status === "rejected") {
    variant = "outline";
  }

  return <Badge variant={variant}>{t(`overtimeStatuses.${status}`)}</Badge>;
}

function useActionToast(state: AttendanceActionResult) {
  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.ok) {
      toast.success(state.message);
    } else {
      toast.error(state.message);
    }
  }, [state]);
}
