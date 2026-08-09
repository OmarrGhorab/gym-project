"use client";

import { type ReactNode, useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { format, parseISO } from "date-fns";
import { CalendarIcon, LocateFixed, LogIn, Upload, UserCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

declare global {
  interface Window {
    BarcodeDetector?: new (options: {
      formats: string[];
    }) => {
      detect(image: HTMLImageElement | HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
    };
  }
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useKeyboardWedgeScanner } from "@/hooks/use-keyboard-wedge-scanner";

import {
  type AttendanceActionResult,
  createManualAttendance,
  type PendingVisitReview,
  scanMemberVisit,
  scanStaffAttendance,
} from "./actions";
import type { AttendanceRecord, EmployeeOption, EmployeeShift, MemberLookupOption } from "./data";
import { DuplicateVisitDialog } from "./duplicate-visit-dialog";

const initialState: AttendanceActionResult = { ok: true, message: "", errors: {}, values: {} };
const fixedTopSelectCollision = {
  align: "shift",
  fallbackAxisSide: "none",
  side: "shift",
} as const;

type Props = {
  correctionRecord?: AttendanceRecord;
  defaultAttendanceDate: string;
  employees: EmployeeOption[];
  members: MemberLookupOption[];
  shifts: EmployeeShift[];
};

export function AttendanceActionPanels({ correctionRecord, defaultAttendanceDate, employees, members, shifts }: Props) {
  return (
    <div id="attendance-actions" className="grid scroll-mt-24 grid-cols-1 gap-4 xl:grid-cols-12">
      <MemberScanCard members={members} />
      <StaffScanCard defaultAttendanceDate={defaultAttendanceDate} employees={employees} />
      <ManualAttendanceCard
        correctionRecord={correctionRecord}
        defaultAttendanceDate={defaultAttendanceDate}
        employees={employees}
        shifts={shifts}
      />
    </div>
  );
}

function MemberScanCard({ members }: { members: MemberLookupOption[] }) {
  const t = useTranslations("Dashboard.attendance");
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, action, pending] = useActionState(scanMemberVisit, initialState);
  useAttendanceActionToast(state, { playSuccessSound: true });
  const location = useGpsLocation();
  const [qrToken, setQrToken] = useState("");
  const [scanMethod, setScanMethod] = useState<"qr" | "scanner" | "manual">("scanner");
  const [selectedMember, setSelectedMember] = useState<MemberLookupOption | null>(null);
  const [selectedAddonId, setSelectedAddonId] = useState("none");
  const [memberLookupSource, setMemberLookupSource] = useState<"member_id" | "phone" | "name" | null>(null);
  const [lookupMembers, setLookupMembers] = useState(members);
  // Mirrored into local state so resolving the dialog can dismiss it; the action
  // result itself only changes on the next scan.
  const [pendingReview, setPendingReview] = useState<PendingVisitReview | null>(null);
  const clearPendingReview = useCallback(() => setPendingReview(null), []);
  const selectMember = useCallback(
    (member: MemberLookupOption | null, source: "member_id" | "phone" | "name" | null) => {
      setSelectedMember(member);
      setMemberLookupSource(source);
      setSelectedAddonId("none");

      if (!member) {
        return;
      }

      setLookupMembers((current) => mergeMemberLookup(current, [member]));
    },
    [],
  );
  const handleMemberSearch = useCallback(
    async (query: string) => {
      const nextMembers = await fetchMemberLookup(query, members);
      setLookupMembers(mergeMemberLookup(selectedMember ? [selectedMember] : [], nextMembers));
    },
    [members, selectedMember],
  );
  const idOptions = useMemo(() => memberIdSelectOptions(lookupMembers), [lookupMembers]);
  const phoneOptions = useMemo(() => memberPhoneSelectOptions(lookupMembers), [lookupMembers]);
  const nameOptions = useMemo(() => memberNameSelectOptions(lookupMembers), [lookupMembers]);
  const activeAddons = (selectedMember?.latest_subscription?.addons ?? []).filter(
    (addon) => !addon.status || addon.status === "active",
  );
  const membershipSessions = selectedMember?.latest_subscription?.sessions_remaining;

  useEffect(() => {
    if (state.ok && state.message) {
      setQrToken("");
      setSelectedMember(null);
      setMemberLookupSource(null);
      setSelectedAddonId("none");
      setPendingReview(state.review ?? null);
      if (formRef.current) {
        formRef.current.reset();
      }
    }
  }, [state]);

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
        <form ref={formRef} action={action} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="direction" value="check-in" />
          <input type="hidden" name="scan_method" value={scanMethod} />
          <input type="hidden" name="member_id" value={selectedMember ? String(selectedMember.id) : ""} />
          <input
            type="hidden"
            name="phone"
            value={memberLookupSource === "phone" ? (selectedMember?.phone ?? "") : ""}
          />
          <input type="hidden" name="name" value={memberLookupSource === "name" ? (selectedMember?.name ?? "") : ""} />
          <ScanSourceToggle value={scanMethod} onChange={setScanMethod} />
          {scanMethod === "scanner" ? (
            <HardwareScannerInput
              id="member-hardware-scanner"
              label={t("scannerDevice")}
              help={t("scannerDeviceHelp")}
              onScan={(value) => {
                const cleanValue = normalizeArabicKeyboardLayout(value);
                setQrToken(cleanValue);
                selectMember(null, null);
                setScanMethod("scanner");
                toast.success(t("scannerCaptured"));
                setTimeout(() => {
                  formRef.current?.requestSubmit();
                }, 80);
              }}
            />
          ) : null}
          {scanMethod === "qr" ? (
            <QrImageScanner
              label={t("scanQrImage")}
              placeholder={t("scanQrImageHelp")}
              onDecoded={(value) => {
                setQrToken(value);
                selectMember(null, null);
                setScanMethod("qr");
                toast.success(t("qrDecoded"));
              }}
            />
          ) : null}
          <FieldGroup>
            <FieldLabel htmlFor="member-qr-token" label={t("memberQrTokenLabel")} meta={t("optionalField")} />
            <Input
              id="member-qr-token"
              name="qr_token"
              placeholder={t("memberQrPlaceholder")}
              value={qrToken}
              onChange={(event) => {
                const nextValue = event.target.value;
                setQrToken(nextValue);

                if (nextValue.trim()) {
                  selectMember(null, null);
                  if (scanMethod !== "scanner") {
                    setScanMethod("manual");
                  }
                }
              }}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="member-id" label={t("memberIdLabel")} meta={t("lookupField")} />
            <FormSelect
              className="w-full"
              contentClassName="max-h-80"
              id="member-id"
              name="member_id_lookup"
              options={idOptions}
              placeholder={t("memberIdPlaceholder")}
              selectedLabel={selectedMember ? memberIdLabel(selectedMember) : undefined}
              value={selectedMember ? String(selectedMember.id) : ""}
              contentCollisionAvoidance={fixedTopSelectCollision}
              contentSide="top"
              onOptionSelect={(option) => selectMember(memberFromOption(option), "member_id")}
              onSearchChange={handleMemberSearch}
              searchPlaceholder={t("searchMembers")}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="member-phone" label={t("phoneLabel")} meta={t("lookupField")} />
            <FormSelect
              className="w-full"
              contentClassName="max-h-80"
              id="member-phone"
              name="phone_lookup"
              options={phoneOptions}
              placeholder={t("phonePlaceholder")}
              selectedLabel={selectedMember ? memberPhoneLabel(selectedMember) : undefined}
              value={selectedMember?.phone ?? ""}
              contentCollisionAvoidance={fixedTopSelectCollision}
              contentSide="top"
              onOptionSelect={(option) => selectMember(memberFromOption(option), "phone")}
              onSearchChange={handleMemberSearch}
              searchPlaceholder={t("searchMembers")}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="member-name" label={t("memberNameLabel")} meta={t("lookupField")} />
            <FormSelect
              className="w-full"
              contentClassName="max-h-80"
              id="member-name"
              name="name_lookup"
              options={nameOptions}
              placeholder={t("namePlaceholder")}
              selectedLabel={selectedMember ? memberNameLabel(selectedMember) : undefined}
              value={selectedMember?.name ?? ""}
              contentCollisionAvoidance={fixedTopSelectCollision}
              contentSide="top"
              onOptionSelect={(option) => selectMember(memberFromOption(option), "name")}
              onSearchChange={handleMemberSearch}
              searchPlaceholder={t("searchMembers")}
            />
          </FieldGroup>
          {selectedMember?.latest_subscription ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs md:col-span-2">
              <p className="font-medium text-sm">
                {selectedMember.latest_subscription.plan_name ?? t("membership")} ·{" "}
                {selectedMember.latest_subscription.status}
              </p>
              <p className="text-muted-foreground">
                {membershipSessions === null || membershipSessions === undefined
                  ? t("unlimitedSessions")
                  : t("sessionsRemaining", { count: membershipSessions })}
              </p>
            </div>
          ) : null}
          {activeAddons.length > 0 ? (
            <FieldGroup className="md:col-span-2">
              <FieldLabel htmlFor="member-addon" label={t("consumeAddon")} meta={t("optionalField")} />
              <FormSelect
                id="member-addon"
                name="subscription_addon_id"
                value={selectedAddonId}
                onValueChange={setSelectedAddonId}
                placeholder={t("addonNone")}
                options={[
                  { value: "none", label: t("addonNone") },
                  ...activeAddons.map((addon) => ({
                    value: String(addon.id),
                    label: [
                      addon.plan?.name ?? t("addon"),
                      addon.sessions_remaining === null || addon.sessions_remaining === undefined
                        ? t("unlimitedSessions")
                        : t("sessionsRemaining", { count: addon.sessions_remaining }),
                    ].join(" · "),
                  })),
                ]}
              />
              <p className="text-muted-foreground text-xs">{t("consumeAddonHelp")}</p>
            </FieldGroup>
          ) : null}
          <GpsFields location={location} />
          <FieldGroup className="md:col-span-2">
            <FieldLabel htmlFor="member-scan-notes" label={t("notesLabel")} meta={t("optionalField")} />
            <Textarea id="member-scan-notes" name="notes" placeholder={t("notesPlaceholder")} />
          </FieldGroup>
          <PanelFooter pending={pending} label={t("submitMemberScan")} />
        </form>
      </CardContent>
      <DuplicateVisitDialog review={pendingReview} onResolved={clearPendingReview} />
    </Card>
  );
}

function StaffScanCard({
  defaultAttendanceDate,
  employees,
}: {
  defaultAttendanceDate: string;
  employees: EmployeeOption[];
}) {
  const t = useTranslations("Dashboard.attendance");
  const staffFormRef = useRef<HTMLFormElement | null>(null);
  const [state, action, pending] = useActionState(scanStaffAttendance, initialState);
  useAttendanceActionToast(state);
  const location = useGpsLocation();
  const [scanValue, setScanValue] = useState("");
  const [scanMethod, setScanMethod] = useState<"qr" | "scanner" | "manual">("scanner");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [lookupEmployees, setLookupEmployees] = useState(employees);

  useEffect(() => {
    if (state.ok && state.message) {
      setScanValue("");
      setSelectedEmployee(null);
      if (staffFormRef.current) {
        staffFormRef.current.reset();
      }
    }
  }, [state]);

  const selectEmployee = useCallback((employee: EmployeeOption | null) => {
    setSelectedEmployee(employee);

    if (!employee) {
      setScanValue("");
      return;
    }

    setLookupEmployees((current) => mergeEmployeeLookup(current, [employee]));
    setScanValue(employee.attendance_qr ?? (employee.attendance_code ? `employee:${employee.attendance_code}` : ""));
  }, []);
  const handleEmployeeSearch = useCallback(
    async (query: string) => {
      const nextEmployees = await fetchEmployeeLookup(query, employees);
      setLookupEmployees(mergeEmployeeLookup(selectedEmployee ? [selectedEmployee] : [], nextEmployees));
    },
    [employees, selectedEmployee],
  );
  const employeeOptions = useMemo(() => employeeSelectOptions(lookupEmployees, true), [lookupEmployees]);

  useEffect(() => {
    const query = scanValue.trim();

    if (!query) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      const matches = await fetchEmployeeLookup(query, employees);

      if (matches.length === 1) {
        selectEmployee(matches[0]);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [employees, scanValue, selectEmployee]);

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
        <form ref={staffFormRef} action={action} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="attendance_date" value={defaultAttendanceDate} />
          <input type="hidden" name="scan_method" value={scanMethod} />
          <FieldGroup>
            <FieldLabel htmlFor="staff-scan-direction" label={t("scanDirection")} meta={t("requiredField")} />
            <ScanDirectionSelect id="staff-scan-direction" />
          </FieldGroup>
          <ScanSourceToggle value={scanMethod} onChange={setScanMethod} />
          {scanMethod === "scanner" ? (
            <HardwareScannerInput
              id="staff-hardware-scanner"
              label={t("scannerDevice")}
              help={t("scannerDeviceHelp")}
              onScan={(value) => {
                const cleanValue = normalizeArabicKeyboardLayout(value);
                setScanValue(cleanValue);
                setSelectedEmployee(null);
                setScanMethod("scanner");
                toast.success(t("scannerCaptured"));
                setTimeout(() => {
                  staffFormRef.current?.requestSubmit();
                }, 80);
              }}
            />
          ) : null}
          {scanMethod === "qr" ? (
            <QrImageScanner
              label={t("scanQrImage")}
              placeholder={t("scanQrImageHelp")}
              onDecoded={(value) => {
                setScanValue(value);
                setScanMethod("qr");
                toast.success(t("qrDecoded"));
              }}
            />
          ) : null}
          <FieldGroup>
            <FieldLabel htmlFor="employee-qr-token" label={t("employeeQrTokenLabel")} meta={t("lookupField")} />
            <Input
              id="employee-qr-token"
              name="qr_token"
              placeholder={t("employeeQrPlaceholder")}
              value={scanValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                setScanValue(nextValue);

                if (!nextValue.trim()) {
                  setSelectedEmployee(null);
                } else if (scanMethod !== "scanner") {
                  setScanMethod("manual");
                }
              }}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="employee-id" label={t("employeeLabel")} meta={t("lookupField")} />
            <FormSelect
              className="w-full"
              contentClassName="max-h-80"
              id="employee-id"
              name="employee_id"
              options={employeeOptions}
              placeholder={t("selectEmployee")}
              selectedLabel={selectedEmployee ? employeeLabel(selectedEmployee, true) : undefined}
              value={selectedEmployee ? String(selectedEmployee.id) : ""}
              contentCollisionAvoidance={fixedTopSelectCollision}
              contentSide="top"
              onOptionSelect={(option) => selectEmployee(employeeFromOption(option))}
              onSearchChange={handleEmployeeSearch}
              searchPlaceholder={t("searchEmployees")}
            />
          </FieldGroup>
          <GpsFields location={location} />
          <FieldGroup className="md:col-span-2">
            <FieldLabel htmlFor="staff-scan-notes" label={t("notesLabel")} meta={t("optionalField")} />
            <Textarea id="staff-scan-notes" name="notes" placeholder={t("notesPlaceholder")} />
          </FieldGroup>
          <PanelFooter pending={pending} label={t("submitStaffScan")} />
        </form>
      </CardContent>
    </Card>
  );
}

function ManualAttendanceCard({
  correctionRecord,
  defaultAttendanceDate,
  employees,
  shifts,
}: {
  correctionRecord?: AttendanceRecord;
  defaultAttendanceDate: string;
  employees: EmployeeOption[];
  shifts: EmployeeShift[];
}) {
  const t = useTranslations("Dashboard.attendance");
  const [state, action, pending] = useActionState(createManualAttendance, initialState);
  useAttendanceActionToast(state);
  const employeeOptions = useMemo(() => employeeSelectOptions(employees), [employees]);
  const isCorrection = Boolean(correctionRecord);

  return (
    <Card id="manual-correction" className="scroll-mt-4 xl:col-span-12">
      <CardHeader>
        <CardTitle className="font-normal">
          {isCorrection ? t("manualAttendanceCorrection") : t("manualAttendance")}
        </CardTitle>
        <CardDescription>
          {isCorrection
            ? t("manualAttendanceCorrectionDescription", {
                employee: correctionRecord?.employee?.name ?? t("employee"),
              })
            : t("manualAttendanceDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="attendance_id" value={correctionRecord?.id ?? ""} />
          <FieldGroup>
            <FieldLabel htmlFor="manual-employee-id" label={t("employeeLabel")} meta={t("requiredField")} />
            <FormSelect
              className="w-full"
              contentClassName="max-h-80"
              id="manual-employee-id"
              name="employee_id"
              options={employeeOptions}
              placeholder={t("selectEmployee")}
              contentCollisionAvoidance={fixedTopSelectCollision}
              contentSide="top"
              defaultValue={correctionRecord?.employee_id ?? ""}
              required
              searchPlaceholder={t("searchEmployees")}
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="manual-shift-id" label={t("shiftLabel")} meta={t("optionalField")} />
            <Select name="shift_id" defaultValue={correctionRecord?.shift_id ? String(correctionRecord.shift_id) : ""}>
              <SelectTrigger id="manual-shift-id" className="w-full">
                <SelectValue placeholder={t("noShift")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {shifts.map((shift) => (
                    <SelectItem key={shift.id} value={String(shift.id)}>
                      {shift.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldGroup>
          <DatePickerField
            label={t("attendanceDate")}
            name="date"
            defaultValue={correctionRecord?.date ?? defaultAttendanceDate}
            required
          />
          <TimePickerField label={t("checkInTime")} name="check_in" defaultValue={correctionRecord?.check_in ?? ""} />
          <TimePickerField
            label={t("checkOutTime")}
            name="check_out"
            defaultValue={correctionRecord?.check_out ?? ""}
          />
          <FieldGroup>
            <FieldLabel htmlFor="manual-status" label={t("status")} meta={t("requiredField")} />
            <Select name="status" defaultValue={correctionRecord?.status ?? "present"}>
              <SelectTrigger id="manual-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="present">{t("statuses.present")}</SelectItem>
                  <SelectItem value="late">{t("statuses.late")}</SelectItem>
                  <SelectItem value="absent">{t("statuses.absent")}</SelectItem>
                  <SelectItem value="excused">{t("statuses.excused")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="manual-schedule-status" label={t("scheduleStatus")} meta={t("optionalField")} />
            <Select name="schedule_status" defaultValue={correctionRecord?.schedule_status ?? ""}>
              <SelectTrigger id="manual-schedule-status" className="w-full">
                <SelectValue placeholder={t("scheduleStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="on_shift">{t("scheduleStatuses.on_shift")}</SelectItem>
                  <SelectItem value="late">{t("scheduleStatuses.late")}</SelectItem>
                  <SelectItem value="off_shift">{t("scheduleStatuses.off_shift")}</SelectItem>
                  <SelectItem value="unassigned">{t("scheduleStatuses.unassigned")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="manual-approval-status" label={t("approvalStatus")} meta={t("optionalField")} />
            <Select name="approval_status" defaultValue={correctionRecord?.approval_status ?? ""}>
              <SelectTrigger id="manual-approval-status" className="w-full">
                <SelectValue placeholder={t("approvalStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="approved">{t("approvalStatuses.approved")}</SelectItem>
                  <SelectItem value="pending">{t("approvalStatuses.pending")}</SelectItem>
                  <SelectItem value="dismissed">{t("approvalStatuses.dismissed")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup className="md:col-span-3">
            <div className="flex items-start gap-2 rounded-md border bg-muted/20 p-3">
              {/* Checked by default so a hand-entered late arrival is treated like a scan;
                  clearing it records the time without any payroll penalty. */}
              <Checkbox id="manual-apply-penalty" name="apply_penalty" defaultChecked />
              <div className="grid gap-0.5">
                <Label htmlFor="manual-apply-penalty" className="font-medium">
                  {t("applyPenalty")}
                </Label>
                <p className="text-muted-foreground text-xs">{t("applyPenaltyHelp")}</p>
              </div>
            </div>
          </FieldGroup>
          <FieldGroup className="md:col-span-3">
            <FieldLabel htmlFor="manual-notes" label={t("notesLabel")} meta={t("optionalField")} />
            <Textarea
              id="manual-notes"
              name="notes"
              placeholder={t("notesPlaceholder")}
              defaultValue={correctionRecord?.notes ?? ""}
            />
          </FieldGroup>
          <PanelFooter pending={pending} label={isCorrection ? t("saveAttendanceCorrection") : t("createAttendance")} />
        </form>
      </CardContent>
    </Card>
  );
}

function FieldGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={["grid gap-2", className].filter(Boolean).join(" ")}>{children}</div>;
}

function FieldLabel({ htmlFor, label, meta }: { htmlFor: string; label: string; meta: string }) {
  return (
    <Label htmlFor={htmlFor} className="justify-between gap-3">
      <span>{label}</span>
      <span className="font-normal text-muted-foreground text-xs">{meta}</span>
    </Label>
  );
}

function ScanDirectionSelect({ id }: { id: string }) {
  const t = useTranslations("Dashboard.attendance");

  return (
    <Select name="direction" defaultValue="check-in">
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="check-in">{t("checkIn")}</SelectItem>
          <SelectItem value="check-out">{t("checkOut")}</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function employeeSelectOptions(employees: EmployeeOption[], includeRole = false) {
  return employees.map((employee) => ({
    data: employee,
    key: `employee-${employee.id}`,
    label: employeeLabel(employee, includeRole),
    value: String(employee.id),
  }));
}

function employeeLabel(employee: EmployeeOption, includeRole = false) {
  return includeRole ? `${employee.name} - ${employee.role}` : employee.name;
}

function employeeFromOption(option: { data?: unknown } | null): EmployeeOption | null {
  if (!option?.data) {
    return null;
  }

  return option.data as EmployeeOption;
}

function mergeEmployeeLookup(current: EmployeeOption[], next: EmployeeOption[]) {
  const employeesById = new Map<number, EmployeeOption>();

  for (const employee of [...current, ...next]) {
    employeesById.set(employee.id, employee);
  }

  return Array.from(employeesById.values());
}

function memberIdSelectOptions(members: MemberLookupOption[]) {
  return members.map((member) => ({
    data: member,
    key: `member-id-${member.id}`,
    label: memberIdLabel(member),
    value: String(member.id),
  }));
}

function memberPhoneSelectOptions(members: MemberLookupOption[]) {
  return members
    .filter((member) => member.phone)
    .map((member) => ({
      data: member,
      key: `member-phone-${member.id}`,
      label: memberPhoneLabel(member),
      value: member.phone ?? "",
    }));
}

function memberNameSelectOptions(members: MemberLookupOption[]) {
  return members.map((member) => ({
    data: member,
    key: `member-name-${member.id}`,
    label: memberNameLabel(member),
    value: member.name,
  }));
}

function memberIdLabel(member: MemberLookupOption) {
  return `#${member.id} - ${member.name}${member.phone ? ` - ${member.phone}` : ""}`;
}

function memberPhoneLabel(member: MemberLookupOption) {
  return `${member.phone} - ${member.name}`;
}

function memberNameLabel(member: MemberLookupOption) {
  return `${member.name}${member.phone ? ` - ${member.phone}` : ` - #${member.id}`}`;
}

function memberFromOption(option: { data?: unknown } | null): MemberLookupOption | null {
  if (!option?.data) {
    return null;
  }

  return option.data as MemberLookupOption;
}

function mergeMemberLookup(current: MemberLookupOption[], next: MemberLookupOption[]) {
  const membersById = new Map<number, MemberLookupOption>();

  for (const member of [...current, ...next]) {
    membersById.set(member.id, member);
  }

  return Array.from(membersById.values());
}

async function fetchMemberLookup(query: string, fallback: MemberLookupOption[]) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return fallback;
  }

  try {
    const response = await fetch(`/api/attendance/member-lookup?q=${encodeURIComponent(normalizedQuery)}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as { data?: MemberLookupOption[] | { data?: MemberLookupOption[] } };

    if (Array.isArray(payload.data)) {
      return payload.data;
    }

    return payload.data?.data ?? fallback;
  } catch {
    return fallback;
  }
}

async function fetchEmployeeLookup(query: string, fallback: EmployeeOption[]) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return fallback;
  }

  try {
    const response = await fetch(`/api/attendance/employee-lookup?q=${encodeURIComponent(normalizedQuery)}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as { data?: EmployeeOption[] | { data?: EmployeeOption[] } };

    if (Array.isArray(payload.data)) {
      return payload.data;
    }

    return payload.data?.data ?? fallback;
  } catch {
    return fallback;
  }
}

function DatePickerField({
  defaultValue,
  label,
  name,
  required = false,
}: {
  defaultValue: string;
  label: string;
  name: string;
  required?: boolean;
}) {
  const t = useTranslations("Dashboard.attendance");
  const locale = useLocale();
  const [value, setValue] = useState(defaultValue);
  const selectedDate = value ? parseISO(value) : undefined;

  return (
    <FieldGroup>
      <FieldLabel htmlFor={`date-${name}`} label={label} meta={required ? t("requiredField") : t("optionalField")} />
      <input type="hidden" name={name} value={value} required={required} />
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id={`date-${name}`}
              type="button"
              variant="outline"
              className="w-full justify-between font-normal"
            />
          }
        >
          {selectedDate
            ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(selectedDate)
            : t("selectDate")}
          <CalendarIcon data-icon="inline-end" className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto overflow-hidden p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            captionLayout="dropdown"
            onSelect={(date) => {
              if (date) {
                setValue(format(date, "yyyy-MM-dd"));
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </FieldGroup>
  );
}

const TIME_HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const TIME_MINUTES = Array.from({ length: 60 }, (_, index) => index);

function formatTime24(hour: number, minute: number, period: "AM" | "PM"): string {
  const normalizedHour = period === "PM" ? (hour % 12) + 12 : hour % 12;

  return `${String(normalizedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTime24(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    return null;
  }

  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return { hour, minute, period };
}

function TimePickerField({ defaultValue = "", label, name }: { defaultValue?: string; label: string; name: string }) {
  const t = useTranslations("Dashboard.attendance");
  const initial = parseTime24(defaultValue);
  const [hour, setHour] = useState<number | null>(initial ? initial.hour : null);
  const [minute, setMinute] = useState<number | null>(initial ? initial.minute : null);
  const [period, setPeriod] = useState<"AM" | "PM">(initial ? initial.period : "AM");

  const value = hour !== null && minute !== null ? formatTime24(hour, minute, period) : "";

  return (
    <FieldGroup>
      <FieldLabel htmlFor={`time-${name}-hour`} label={label} meta={t("optionalField")} />
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-1.5">
        <Select value={hour !== null ? String(hour) : ""} onValueChange={(next) => setHour(Number(next))}>
          <SelectTrigger id={`time-${name}-hour`} className="w-full">
            <SelectValue placeholder="--" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {TIME_HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {String(h).padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">:</span>
        <Select value={minute !== null ? String(minute) : ""} onValueChange={(next) => setMinute(Number(next))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="--" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {TIME_MINUTES.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {String(m).padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(next) => setPeriod(next as "AM" | "PM")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </FieldGroup>
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

function ScanSourceToggle({
  value,
  onChange,
}: {
  value: "qr" | "scanner" | "manual";
  onChange: (value: "qr" | "scanner" | "manual") => void;
}) {
  const t = useTranslations("Dashboard.attendance");

  return (
    <FieldGroup className="md:col-span-2">
      <FieldLabel htmlFor="scan-source" label={t("scanSource")} meta={t("requiredField")} />
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "scanner", label: t("scanSourceScanner") },
            { id: "qr", label: t("scanSourceCamera") },
            { id: "manual", label: t("scanSourceManual") },
          ] as const
        ).map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={value === option.id ? "default" : "outline"}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </FieldGroup>
  );
}

function normalizeArabicKeyboardLayout(text: string): string {
  const arToEn: Record<string, string> = {
    ض: "q",
    ص: "w",
    ث: "e",
    ق: "r",
    ف: "t",
    غ: "y",
    ع: "u",
    ه: "i",
    خ: "o",
    ح: "p",
    ج: "[",
    د: "]",
    ش: "a",
    س: "s",
    ي: "d",
    ب: "f",
    ل: "g",
    ا: "h",
    ت: "j",
    ن: "k",
    م: "l",
    ك: ";",
    ط: "'",
    ئ: "z",
    ء: "x",
    ؤ: "c",
    ر: "v",
    لا: "b",
    ى: "n",
    ة: "m",
    و: ",",
    ز: ".",
    ظ: "/",
    "َ": "Q",
    "ً": "W",
    "ُ": "E",
    "ٌ": "R",
    لإ: "T",
    إ: "Y",
    "‘": "U",
    "÷": "I",
    "×": "O",
    "؛": "P",
    "ِ": "A",
    "ٍ": "S",
    أ: "H",
    ـ: "J",
    "،": "K",
    لأ: "G",
    آ: "N",
    "’": "M",
    لآ: "B",
  };

  return text
    .split("")
    .map((char) => arToEn[char] || char)
    .join("");
}

function HardwareScannerInput({
  help,
  id,
  label,
  onScan,
}: {
  help: string;
  id: string;
  label: string;
  onScan: (value: string) => void;
}) {
  const t = useTranslations("Dashboard.attendance");
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const [buffer, setBuffer] = useState("");
  const [typed, setTyped] = useState("");

  const handleScan = useCallback(
    (value: string) => {
      const trimmed = value.trim();

      if (!trimmed) {
        return;
      }

      onScan(trimmed);
      setBuffer("");
      setTyped("");
    },
    [onScan],
  );

  // Captures the scanner no matter what the operator last clicked; keystrokes
  // aimed at this field are left to the input below so manual entry still works.
  useKeyboardWedgeScanner({ onScan: handleScan, onBufferChange: setBuffer, ignoreRef: fieldRef });

  return (
    <FieldGroup className="md:col-span-2">
      <FieldLabel htmlFor={id} label={label} meta={t("scannerReady")} />
      <div ref={fieldRef} className="rounded-lg border border-emerald-500/40 border-dashed bg-emerald-500/5 p-3">
        <p className="mb-2 text-muted-foreground text-xs">{help}</p>
        <Input
          id={id}
          autoComplete="off"
          value={buffer || typed}
          placeholder={t("scannerPlaceholder")}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") {
              return;
            }

            event.preventDefault();
            handleScan(typed);
          }}
        />
        <p className="mt-2 text-muted-foreground text-xs">{t("scannerListening")}</p>
      </div>
    </FieldGroup>
  );
}

function QrImageScanner({
  label,
  onDecoded,
  placeholder,
}: {
  label: string;
  onDecoded: (value: string) => void;
  placeholder: string;
}) {
  const t = useTranslations("Dashboard.attendance");
  const [scanning, setScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setScanning(true);

    try {
      const decoded = await decodeQrFromImage(file);

      if (!decoded) {
        toast.error(t("qrNotFound"));
        return;
      }

      onDecoded(decoded);
    } catch {
      toast.error(t("qrDecodeFailed"));
    } finally {
      setScanning(false);
      event.target.value = "";
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false);
      setCameraError(t("cameraNotSupported"));
      return;
    }

    setCameraError(null);
    setCameraOpen(true);
    setCameraSupported(true);
  }

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
    setCameraActive(false);
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function attachCamera() {
      if (!cameraOpen) {
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (cancelled) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }

        streamRef.current = stream;
        setCameraActive(true);

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          void scanCameraFrame();
        }
      } catch {
        setCameraError(t("cameraDenied"));
        setCameraOpen(false);
        setCameraActive(false);
      }
    }

    async function scanCameraFrame() {
      const Detector = window.BarcodeDetector;
      const video = videoRef.current;

      if (!Detector || !video || !streamRef.current) {
        return;
      }

      try {
        const detector = new Detector({ formats: ["qr_code"] });
        const codes = await detector.detect(video);
        const value = codes[0]?.rawValue;

        if (value) {
          onDecoded(value);
          toast.success(t("qrDecoded"));
          stopCamera();
          return;
        }
      } catch {
        // keep trying while the camera is open
      }

      if (cameraOpen && !cancelled) {
        frameRef.current = requestAnimationFrame(() => {
          void scanCameraFrame();
        });
      }
    }

    void attachCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [cameraOpen, onDecoded, stopCamera, t]);

  return (
    <div className="grid gap-2 md:col-span-2">
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div className="grid gap-1">
          <p className="font-medium text-sm">{label}</p>
          <p className="text-muted-foreground text-xs">{placeholder}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Upload className="size-4" />
            <span>{scanning ? t("decoding") : t("uploadQrImage")}</span>
            <input accept="image/*" className="hidden" type="file" onChange={handleFileChange} />
          </label>
          {cameraOpen ? (
            <Button type="button" size="sm" variant="outline" onClick={stopCamera}>
              {t("stopCamera")}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={startCamera}
              disabled={!cameraSupported && cameraError !== null}
            >
              {t("startCamera")}
            </Button>
          )}
        </div>
      </div>
      {cameraOpen ? (
        <div className="grid gap-2 rounded-lg border p-3">
          <video ref={videoRef} className="aspect-video w-full rounded-md bg-black object-cover" muted playsInline />
          <p className="text-muted-foreground text-xs">{t("cameraHelp")}</p>
        </div>
      ) : null}
      {cameraError ? <p className="text-destructive text-xs">{cameraError}</p> : null}
      {cameraOpen && !cameraActive ? <p className="text-muted-foreground text-xs">{t("cameraStarting")}</p> : null}
    </div>
  );
}

async function decodeQrFromImage(file: File): Promise<string | null> {
  const Detector = window.BarcodeDetector;

  if (!Detector) {
    return null;
  }

  const detector = new Detector({ formats: ["qr_code"] });
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(imageUrl);
    const codes = await detector.detect(image);

    return codes[0]?.rawValue ?? null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load QR image."));
    image.src = src;
  });
}

function PanelFooter({ disabled = false, label, pending }: { disabled?: boolean; label: string; pending: boolean }) {
  const t = useTranslations("Dashboard.attendance");

  return (
    <div className="flex items-center justify-end gap-3 md:col-span-full">
      <Button type="submit" disabled={pending || disabled}>
        {pending ? t("submitting") : label}
      </Button>
    </div>
  );
}

function useAttendanceActionToast(
  state: AttendanceActionResult,
  { playSuccessSound = false }: { playSuccessSound?: boolean } = {},
) {
  const notificationAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!state.message) {
      return;
    }

    // A scan awaiting approval raises a dialog that says the same thing and asks
    // for a decision. A success toast and chime next to it would read as "done".
    if (state.review) {
      return;
    }

    if (state.ok) {
      if (playSuccessSound) {
        notificationAudio.current ??= new Audio("/notifications.mp3");

        notificationAudio.current.currentTime = 0;
        void notificationAudio.current.play().catch(() => {
          // Browsers can block sound until the operator has interacted with the page.
        });
      }

      toast.success(state.message);
      return;
    }

    toast.error(state.message);
  }, [playSuccessSound, state]);
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
