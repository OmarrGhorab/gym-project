"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { CheckCircle2, LocateFixed, LogIn, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import {
  type AttendanceActionResult,
  createManualAttendance,
  reviewAttendanceViolation,
  scanMemberVisit,
  scanStaffAttendance,
} from "./actions";
import type { AttendanceViolation, EmployeeOption, EmployeeShift } from "./data";

const initialState: AttendanceActionResult = { ok: true, message: "" };

type Props = {
  employees: EmployeeOption[];
  shifts: EmployeeShift[];
  violations: AttendanceViolation[];
};

export function AttendanceActionPanels({ employees, shifts, violations }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <MemberScanCard />
      <StaffScanCard employees={employees} />
      <ManualAttendanceCard employees={employees} shifts={shifts} />
      <ViolationReviewCard violations={violations} />
    </div>
  );
}

function MemberScanCard() {
  const t = useTranslations("Dashboard.attendance");
  const [state, action, pending] = useActionState(scanMemberVisit, initialState);
  const location = useGpsLocation();

  return (
    <Card className="xl:col-span-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-normal">
          <UserCheck className="size-4" />
          {t("memberStation")}
        </CardTitle>
        <CardDescription>{t("memberStationDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3 md:grid-cols-2">
          <ScanDirectionSelect />
          <Input name="qr_token" placeholder={t("memberQrPlaceholder")} />
          <Input name="member_id" inputMode="numeric" placeholder={t("memberIdPlaceholder")} />
          <Input name="phone" placeholder={t("phonePlaceholder")} />
          <Input name="name" placeholder={t("namePlaceholder")} />
          <GpsFields location={location} />
          <Textarea name="notes" placeholder={t("notesPlaceholder")} className="md:col-span-2" />
          <PanelFooter state={state} pending={pending} label={t("submitMemberScan")} />
        </form>
      </CardContent>
    </Card>
  );
}

function StaffScanCard({ employees }: { employees: EmployeeOption[] }) {
  const t = useTranslations("Dashboard.attendance");
  const [state, action, pending] = useActionState(scanStaffAttendance, initialState);
  const location = useGpsLocation();

  return (
    <Card className="xl:col-span-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-normal">
          <LogIn className="size-4" />
          {t("staffStation")}
        </CardTitle>
        <CardDescription>{t("staffStationDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3 md:grid-cols-2">
          <ScanDirectionSelect />
          <Input name="qr_token" placeholder={t("employeeQrPlaceholder")} />
          <NativeSelect name="employee_id" defaultValue="" className="w-full">
            <option value="">{t("selectEmployee")}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} - {employee.role}
              </option>
            ))}
          </NativeSelect>
          <GpsFields location={location} />
          <Textarea name="notes" placeholder={t("notesPlaceholder")} className="md:col-span-2" />
          <PanelFooter state={state} pending={pending} label={t("submitStaffScan")} />
        </form>
      </CardContent>
    </Card>
  );
}

function ManualAttendanceCard({ employees, shifts }: { employees: EmployeeOption[]; shifts: EmployeeShift[] }) {
  const t = useTranslations("Dashboard.attendance");
  const [state, action, pending] = useActionState(createManualAttendance, initialState);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <Card className="xl:col-span-7">
      <CardHeader>
        <CardTitle className="font-normal">{t("manualAttendance")}</CardTitle>
        <CardDescription>{t("manualAttendanceDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3 md:grid-cols-3">
          <NativeSelect name="employee_id" required defaultValue="" className="w-full">
            <option value="">{t("selectEmployee")}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect name="shift_id" defaultValue="" className="w-full">
            <option value="">{t("noShift")}</option>
            {shifts.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.name}
              </option>
            ))}
          </NativeSelect>
          <Input type="date" name="date" defaultValue={today} required />
          <Input type="time" name="check_in" />
          <Input type="time" name="check_out" />
          <NativeSelect name="status" defaultValue="present" className="w-full">
            <option value="present">{t("statuses.present")}</option>
            <option value="late">{t("statuses.late")}</option>
            <option value="absent">{t("statuses.absent")}</option>
            <option value="excused">{t("statuses.excused")}</option>
          </NativeSelect>
          <NativeSelect name="schedule_status" defaultValue="" className="w-full">
            <option value="">{t("scheduleStatus")}</option>
            <option value="on_shift">{t("scheduleStatuses.on_shift")}</option>
            <option value="late">{t("scheduleStatuses.late")}</option>
            <option value="off_shift">{t("scheduleStatuses.off_shift")}</option>
            <option value="unassigned">{t("scheduleStatuses.unassigned")}</option>
          </NativeSelect>
          <NativeSelect name="approval_status" defaultValue="" className="w-full">
            <option value="">{t("approvalStatus")}</option>
            <option value="approved">{t("approvalStatuses.approved")}</option>
            <option value="pending">{t("approvalStatuses.pending")}</option>
            <option value="dismissed">{t("approvalStatuses.dismissed")}</option>
          </NativeSelect>
          <Textarea name="notes" placeholder={t("notesPlaceholder")} className="md:col-span-3" />
          <PanelFooter state={state} pending={pending} label={t("createAttendance")} />
        </form>
      </CardContent>
    </Card>
  );
}

function ViolationReviewCard({ violations }: { violations: AttendanceViolation[] }) {
  const t = useTranslations("Dashboard.attendance");
  const [state, action, pending] = useActionState(reviewAttendanceViolation, initialState);
  const firstViolation = violations[0];

  return (
    <Card className="xl:col-span-5">
      <CardHeader>
        <CardTitle className="font-normal">{t("reviewWarnings")}</CardTitle>
        <CardDescription>{t("reviewWarningsDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <NativeSelect
            name="id"
            required
            defaultValue={firstViolation?.id ? String(firstViolation.id) : ""}
            className="w-full"
          >
            <option value="">{t("selectWarning")}</option>
            {violations.map((violation) => (
              <option key={violation.id} value={violation.id}>
                {violation.employee?.name ?? t("staff")} - {violation.type} - {violation.violation_date}
              </option>
            ))}
          </NativeSelect>
          <div className="grid grid-cols-2 gap-3">
            <NativeSelect name="status" defaultValue="approved" className="w-full">
              <option value="approved">{t("approvalStatuses.approved")}</option>
              <option value="dismissed">{t("approvalStatuses.dismissed")}</option>
            </NativeSelect>
            <Input name="deduction_amount" inputMode="decimal" placeholder={t("deductionAmount")} />
          </div>
          <Input name="deduction_days" inputMode="decimal" placeholder={t("deductionDays")} />
          <Textarea name="notes" placeholder={t("reviewNotes")} />
          <PanelFooter state={state} pending={pending} label={t("reviewWarning")} disabled={!firstViolation} />
        </form>
      </CardContent>
    </Card>
  );
}

function ScanDirectionSelect() {
  const t = useTranslations("Dashboard.attendance");

  return (
    <NativeSelect name="direction" defaultValue="check-in" className="w-full">
      <option value="check-in">{t("checkIn")}</option>
      <option value="check-out">{t("checkOut")}</option>
    </NativeSelect>
  );
}

function GpsFields({ location }: { location: GpsState }) {
  const t = useTranslations("Dashboard.attendance");

  return (
    <div className="flex items-center gap-2 md:col-span-2">
      <input type="hidden" name="latitude" value={location.latitude ?? ""} />
      <input type="hidden" name="longitude" value={location.longitude ?? ""} />
      <input type="hidden" name="accuracy_meters" value={location.accuracy ?? ""} />
      <Badge variant="outline" className="gap-1">
        <LocateFixed className="size-3.5" />
        {location.ready ? t("gpsReady") : t("gpsUnavailable")}
      </Badge>
      {location.error ? <span className="text-muted-foreground text-xs">{location.error}</span> : null}
    </div>
  );
}

function PanelFooter({
  disabled = false,
  label,
  pending,
  state,
}: {
  disabled?: boolean;
  label: string;
  pending: boolean;
  state: AttendanceActionResult;
}) {
  const t = useTranslations("Dashboard.attendance");

  return (
    <div className="flex items-center justify-between gap-3 md:col-span-full">
      <div className={state.ok ? "text-muted-foreground text-xs" : "text-destructive text-xs"}>
        {state.message ? (
          <span className="inline-flex items-center gap-1">
            {state.ok ? <CheckCircle2 className="size-3.5" /> : null}
            {state.message}
          </span>
        ) : null}
      </div>
      <Button type="submit" disabled={pending || disabled}>
        {pending ? t("submitting") : label}
      </Button>
    </div>
  );
}

type GpsState = {
  accuracy: number | null;
  error: string | null;
  latitude: number | null;
  longitude: number | null;
  ready: boolean;
};

function useGpsLocation(): GpsState {
  const [state, setState] = useState<GpsState>({
    accuracy: null,
    error: null,
    latitude: null,
    longitude: null,
    ready: false,
  });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setState((current) => ({ ...current, error: "GPS not supported." }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          accuracy: Math.round(position.coords.accuracy),
          error: null,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          ready: true,
        });
      },
      (error) => {
        setState((current) => ({ ...current, error: error.message }));
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
  }, []);

  return state;
}
