"use client";

import * as React from "react";
import { Clock3, DoorClosed, DoorOpen, Loader2, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QrScanner } from "@/components/attendance/qr-scanner";
import type { AppLocale } from "@/i18n/routing";
import {
  checkInEmployeeAttendance,
  checkInMemberVisit,
  checkOutEmployeeAttendance,
  checkOutMemberVisit,
  type EmployeeScanData,
  type MemberVisitScanData,
  type ScanLocationInput,
} from "@/lib/actions/attendance";
import type { Attendance, MemberVisit, ScanLocation } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type MemberStationState = {
  qr_token: string;
  member_id: string;
  phone: string;
  name: string;
  notes: string;
};

type StaffStationState = {
  qr_token: string;
  employee_id: string;
  notes: string;
};

export function MemberVisitStation() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("AttendancePage");
  const isArabic = locale === "ar";
  const [form, setForm] = React.useState<MemberStationState>({
    qr_token: "",
    member_id: "",
    phone: "",
    name: "",
    notes: "",
  });
  const [isPending, setIsPending] = React.useState<"in" | "out" | null>(null);
  const [locationState, setLocationState] = React.useState<LocationUiState>({ status: "idle" });
  const [lastVisit, setLastVisit] = React.useState<MemberVisit | null>(null);

  function updateForm<K extends keyof MemberStationState>(key: K, value: MemberStationState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(direction: "in" | "out") {
    if (!hasMemberIdentity(form)) {
      toast.error(t("scanIdentityRequired"));
      return;
    }

    setIsPending(direction);
    setLocationState({ status: "loading" });

    try {
      const location = await getCurrentLocation();
      setLocationState({ status: location.latitude == null ? "missing" : "ready", location });
      const payload = buildMemberPayload(form, location);
      const visit = direction === "in"
        ? await checkInMemberVisit(payload, locale as AppLocale)
        : await checkOutMemberVisit(payload, locale as AppLocale);

      setLastVisit(visit);
      showMemberToast(visit, t);
      router.refresh();
    } catch (err) {
      const message = parseActionError(err) ?? t("formError");
      toast.error(message);
      setLocationState((current) => current.status === "loading" ? { status: "idle" } : current);
    } finally {
      setIsPending(null);
    }
  }

  return (
    <Card className="border shadow-xs">
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
        <QrScanner
          labels={scannerLabels(t)}
          onScan={(value) => updateForm("qr_token", value)}
        />

        <div className="space-y-4">
          <div className={cn(isArabic && "text-right")}>
            <h2 className="text-base font-black text-foreground">{t("memberStationTitle")}</h2>
            <p className="text-xs font-semibold text-muted-foreground">{t("memberStationDescription")}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("scanQrToken")} htmlFor="member_qr" isArabic={isArabic}>
              <Input
                id="member_qr"
                value={form.qr_token}
                onChange={(event) => updateForm("qr_token", event.target.value)}
                placeholder="member:... or M-..."
                className={cn(isArabic && "text-right")}
              />
            </Field>
            <Field label={t("memberVisitMemberId")} htmlFor="member_id" isArabic={isArabic}>
              <Input
                id="member_id"
                inputMode="numeric"
                value={form.member_id}
                onChange={(event) => updateForm("member_id", event.target.value)}
                className={cn(isArabic && "text-right")}
              />
            </Field>
            <Field label={t("memberStationPhone")} htmlFor="member_phone" isArabic={isArabic}>
              <Input
                id="member_phone"
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
                className={cn(isArabic && "text-right")}
              />
            </Field>
            <Field label={t("memberStationName")} htmlFor="member_name" isArabic={isArabic}>
              <Input
                id="member_name"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                className={cn(isArabic && "text-right")}
              />
            </Field>
          </div>

          <Field label={t("formNotes")} htmlFor="member_notes" isArabic={isArabic}>
            <Textarea
              id="member_notes"
              rows={2}
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              className={cn("resize-none", isArabic && "text-right")}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => submit("in")} disabled={Boolean(isPending)}>
              {isPending === "in" ? <Loader2 className="size-4 animate-spin" /> : <DoorOpen className="size-4" />}
              {t("scanCheckIn")}
            </Button>
            <Button type="button" variant="outline" onClick={() => submit("out")} disabled={Boolean(isPending)}>
              {isPending === "out" ? <Loader2 className="size-4 animate-spin" /> : <DoorClosed className="size-4" />}
              {t("scanCheckOut")}
            </Button>
          </div>

          <LocationStatus state={locationState} />
          {lastVisit ? <MemberScanResult visit={lastVisit} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function StaffAttendanceStation() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("AttendancePage");
  const isArabic = locale === "ar";
  const [form, setForm] = React.useState<StaffStationState>({
    qr_token: "",
    employee_id: "",
    notes: "",
  });
  const [isPending, setIsPending] = React.useState<"in" | "out" | null>(null);
  const [locationState, setLocationState] = React.useState<LocationUiState>({ status: "idle" });
  const [lastAttendance, setLastAttendance] = React.useState<Attendance | null>(null);

  function updateForm<K extends keyof StaffStationState>(key: K, value: StaffStationState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(direction: "in" | "out") {
    if (!form.qr_token.trim() && !/^[1-9]\d*$/.test(form.employee_id.trim())) {
      toast.error(t("staffIdentityRequired"));
      return;
    }

    setIsPending(direction);
    setLocationState({ status: "loading" });

    try {
      const location = await getCurrentLocation();
      setLocationState({ status: location.latitude == null ? "missing" : "ready", location });
      const payload = buildEmployeePayload(form, location);
      const attendance = direction === "in"
        ? await checkInEmployeeAttendance(payload, locale as AppLocale)
        : await checkOutEmployeeAttendance(payload, locale as AppLocale);

      setLastAttendance(attendance);
      showStaffToast(attendance, t);
      router.refresh();
    } catch (err) {
      const message = parseActionError(err) ?? t("formError");
      toast.error(message);
      setLocationState((current) => current.status === "loading" ? { status: "idle" } : current);
    } finally {
      setIsPending(null);
    }
  }

  return (
    <Card className="border shadow-xs">
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
        <QrScanner
          labels={scannerLabels(t)}
          onScan={(value) => updateForm("qr_token", value)}
        />

        <div className="space-y-4">
          <div className={cn(isArabic && "text-right")}>
            <h2 className="text-base font-black text-foreground">{t("staffStationTitle")}</h2>
            <p className="text-xs font-semibold text-muted-foreground">{t("staffStationDescription")}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("scanQrToken")} htmlFor="staff_qr" isArabic={isArabic}>
              <Input
                id="staff_qr"
                value={form.qr_token}
                onChange={(event) => updateForm("qr_token", event.target.value)}
                placeholder="employee:... or E-..."
                className={cn(isArabic && "text-right")}
              />
            </Field>
            <Field label={t("staffStationEmployeeId")} htmlFor="staff_employee_id" isArabic={isArabic}>
              <Input
                id="staff_employee_id"
                inputMode="numeric"
                value={form.employee_id}
                onChange={(event) => updateForm("employee_id", event.target.value)}
                className={cn(isArabic && "text-right")}
              />
            </Field>
          </div>

          <Field label={t("formNotes")} htmlFor="staff_notes" isArabic={isArabic}>
            <Textarea
              id="staff_notes"
              rows={2}
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              className={cn("resize-none", isArabic && "text-right")}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => submit("in")} disabled={Boolean(isPending)}>
              {isPending === "in" ? <Loader2 className="size-4 animate-spin" /> : <Clock3 className="size-4" />}
              {t("scanCheckIn")}
            </Button>
            <Button type="button" variant="outline" onClick={() => submit("out")} disabled={Boolean(isPending)}>
              {isPending === "out" ? <Loader2 className="size-4 animate-spin" /> : <DoorClosed className="size-4" />}
              {t("scanCheckOut")}
            </Button>
          </div>

          <LocationStatus state={locationState} />
          {lastAttendance ? <StaffScanResult attendance={lastAttendance} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  isArabic,
  children,
}: {
  label: string;
  htmlFor: string;
  isArabic: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className={cn(isArabic && "justify-end")}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function MemberScanResult({ visit }: { visit: MemberVisit }) {
  const t = useTranslations("AttendancePage");
  const locale = useLocale();
  const isArabic = locale === "ar";

  return (
    <div className={cn("rounded-lg border bg-background p-3", isArabic && "text-right")}>
      <div className="flex flex-wrap items-center gap-2">
        <VisitBadge status={visit.status} />
        <Badge variant="outline" className="rounded-md">
          {scanMethodLabel(visit.scan_method, t)}
        </Badge>
        <LocationBadge location={visit.check_out_location ?? visit.check_in_location} />
      </div>
      <p className="mt-2 text-sm font-black text-foreground">
        {visit.member?.name ?? `#${visit.member_id}`}
      </p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">
        {visit.alert_reason ?? visit.subscription?.plan_name ?? t("scanNoAlert")}
      </p>
    </div>
  );
}

function StaffScanResult({ attendance }: { attendance: Attendance }) {
  const t = useTranslations("AttendancePage");
  const locale = useLocale();
  const isArabic = locale === "ar";

  return (
    <div className={cn("rounded-lg border bg-background p-3", isArabic && "text-right")}>
      <div className="flex flex-wrap items-center gap-2">
        <StaffStatusBadge status={attendance.status} />
        <Badge variant="outline" className="rounded-md">
          {scheduleStatusLabel(attendance.schedule_status, t)}
        </Badge>
        <Badge variant="outline" className="rounded-md">
          {approvalStatusLabel(attendance.approval_status, t)}
        </Badge>
        <LocationBadge location={attendance.check_out_location ?? attendance.check_in_location} />
      </div>
      <p className="mt-2 text-sm font-black text-foreground">
        {attendance.employee?.name ?? `#${attendance.employee_id}`}
      </p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">
        {attendance.shift?.name ?? t("shiftUnassigned")} · {t("staffScanLateMinutes", { count: attendance.late_minutes ?? 0 })}
      </p>
    </div>
  );
}

function LocationStatus({ state }: { state: LocationUiState }) {
  const t = useTranslations("AttendancePage");

  if (state.status === "idle") return null;

  const message = state.status === "loading"
    ? t("locationLoading")
    : state.status === "missing"
      ? t("locationMissing")
      : t("locationCaptured", {
          accuracy: Math.round(state.location.accuracy_meters ?? 0),
        });

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
      <MapPin className="size-3.5 text-primary" />
      {message}
    </div>
  );
}

function VisitBadge({ status }: { status: string }) {
  const t = useTranslations("AttendancePage");
  const className = status === "blocked"
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : status === "flagged"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <Badge variant="outline" className={cn("rounded-md text-xs font-bold", className)}>
      {status === "blocked" ? t("memberVisitStatusBlocked") : status === "flagged" ? t("memberVisitStatusFlagged") : t("memberVisitStatusAllowed")}
    </Badge>
  );
}

function StaffStatusBadge({ status }: { status: string }) {
  const t = useTranslations("AttendancePage");
  const className = status === "late"
    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    : status === "absent"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

  return (
    <Badge variant="outline" className={cn("rounded-md text-xs font-bold", className)}>
      {status === "late" ? t("statusLate") : status === "absent" ? t("statusAbsent") : t("statusPresent")}
    </Badge>
  );
}

function LocationBadge({ location }: { location?: ScanLocation | null }) {
  const t = useTranslations("AttendancePage");
  const status = location?.status ?? "missing";
  const className = status === "outside"
    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    : status === "inside"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-slate-500/20 bg-slate-500/10 text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("rounded-md text-xs font-bold", className)}>
      {locationStatusLabel(status, t)}
    </Badge>
  );
}

type LocationUiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "missing"; location?: ScanLocationInput }
  | { status: "ready"; location: ScanLocationInput };

function scannerLabels(t: (key: string) => string) {
  return {
    start: t("scannerStart"),
    stop: t("scannerStop"),
    unsupported: t("scannerUnsupported"),
    permissionError: t("scannerPermissionError"),
    scanning: t("scannerScanning"),
  };
}

async function getCurrentLocation(): Promise<ScanLocationInput> {
  if (!navigator.geolocation) {
    return {};
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_meters: position.coords.accuracy ? Math.round(position.coords.accuracy) : null,
        });
      },
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

function hasMemberIdentity(form: MemberStationState) {
  return Boolean(
    form.qr_token.trim() ||
      /^[1-9]\d*$/.test(form.member_id.trim()) ||
      form.phone.trim() ||
      form.name.trim()
  );
}

function buildMemberPayload(form: MemberStationState, location: ScanLocationInput): MemberVisitScanData {
  return {
    ...location,
    qr_token: form.qr_token.trim() || null,
    member_id: /^[1-9]\d*$/.test(form.member_id.trim()) ? Number(form.member_id) : null,
    phone: form.phone.trim() || null,
    name: form.name.trim() || null,
    notes: form.notes.trim() || null,
  };
}

function buildEmployeePayload(form: StaffStationState, location: ScanLocationInput): EmployeeScanData {
  return {
    ...location,
    qr_token: form.qr_token.trim() || null,
    employee_id: /^[1-9]\d*$/.test(form.employee_id.trim()) ? Number(form.employee_id) : null,
    notes: form.notes.trim() || null,
  };
}

function showMemberToast(visit: MemberVisit, t: (key: string) => string) {
  if (visit.status === "blocked") {
    toast.warning(visit.alert_reason ?? t("memberVisitBlocked"));
    return;
  }
  if (visit.status === "flagged") {
    toast.warning(visit.alert_reason ?? t("memberVisitFlagged"));
    return;
  }
  toast.success(t("memberVisitAllowed"));
}

function showStaffToast(attendance: Attendance, t: (key: string, values?: Record<string, number>) => string) {
  if (attendance.approval_status === "pending" || attendance.schedule_status === "off_shift") {
    toast.warning(t("staffScanPending"));
    return;
  }
  if ((attendance.late_minutes ?? 0) > 0) {
    toast.warning(t("staffScanLate", { count: attendance.late_minutes ?? 0 }));
    return;
  }
  toast.success(t("staffScanRecorded"));
}

function parseActionError(error: unknown) {
  if (!(error instanceof Error)) return null;
  try {
    const parsed = JSON.parse(error.message) as { message?: string };
    return parsed.message ?? error.message;
  } catch {
    return error.message;
  }
}

function scanMethodLabel(method: string | null | undefined, t: (key: string) => string) {
  switch (method) {
    case "qr":
      return t("scanMethodQr");
    case "phone":
      return t("scanMethodPhone");
    case "name":
      return t("scanMethodName");
    default:
      return t("scanMethodManual");
  }
}

function scheduleStatusLabel(status: string | null | undefined, t: (key: string) => string) {
  switch (status) {
    case "on_shift":
      return t("scheduleOnShift");
    case "late":
      return t("scheduleLate");
    case "off_shift":
      return t("scheduleOffShift");
    case "unassigned":
      return t("scheduleUnassigned");
    default:
      return status ?? t("scheduleUnknown");
  }
}

function approvalStatusLabel(status: string | null | undefined, t: (key: string) => string) {
  switch (status) {
    case "pending":
      return t("approvalPending");
    case "approved":
      return t("approvalApproved");
    case "dismissed":
      return t("approvalDismissed");
    default:
      return status ?? t("approvalUnknown");
  }
}

function locationStatusLabel(status: string | null | undefined, t: (key: string) => string) {
  switch (status) {
    case "inside":
      return t("locationInside");
    case "outside":
      return t("locationOutside");
    case "unconfigured":
      return t("locationUnconfigured");
    default:
      return t("locationMissingShort");
  }
}
