"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { format, parseISO } from "date-fns";
import { CalendarIcon, CheckCircle2, LocateFixed, LogIn, Upload, UserCheck } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [scanValue, setScanValue] = useState("");

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
          <QrImageScanner
            label={t("scanQrImage")}
            placeholder={t("scanQrImageHelp")}
            onDecoded={(value) => {
              setScanValue(value);
              toast.success(t("qrDecoded"));
            }}
          />
          <Input
            name="qr_token"
            placeholder={t("memberQrPlaceholder")}
            value={scanValue}
            onChange={(event) => setScanValue(event.target.value)}
          />
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
  const [scanValue, setScanValue] = useState("");

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
          <QrImageScanner
            label={t("scanQrImage")}
            placeholder={t("scanQrImageHelp")}
            onDecoded={(value) => {
              setScanValue(value);
              toast.success(t("qrDecoded"));
            }}
          />
          <Input
            name="qr_token"
            placeholder={t("employeeQrPlaceholder")}
            value={scanValue}
            onChange={(event) => setScanValue(event.target.value)}
          />
          <Select name="employee_id" defaultValue="">
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectEmployee")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={String(employee.id)}>
                    {employee.name} - {employee.role}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
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
          <Select name="employee_id" required defaultValue="">
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectEmployee")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={String(employee.id)}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select name="shift_id" defaultValue="">
            <SelectTrigger className="w-full">
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
          <DatePickerField name="date" defaultValue={today} required />
          <TimePickerField name="check_in" />
          <TimePickerField name="check_out" />
          <Select name="status" defaultValue="present">
            <SelectTrigger className="w-full">
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
          <Select name="schedule_status" defaultValue="">
            <SelectTrigger className="w-full">
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
          <Select name="approval_status" defaultValue="">
            <SelectTrigger className="w-full">
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
          <Select name="id" required defaultValue={firstViolation?.id ? String(firstViolation.id) : ""}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectWarning")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {violations.map((violation) => (
                  <SelectItem key={violation.id} value={String(violation.id)}>
                    {violation.employee?.name ?? t("staff")} - {violation.type} - {violation.violation_date}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select name="status" defaultValue="approved">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="approved">{t("approvalStatuses.approved")}</SelectItem>
                  <SelectItem value="dismissed">{t("approvalStatuses.dismissed")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
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
    <Select name="direction" defaultValue="check-in">
      <SelectTrigger className="w-full">
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

function DatePickerField({
  defaultValue,
  name,
  required = false,
}: {
  defaultValue: string;
  name: string;
  required?: boolean;
}) {
  const t = useTranslations("Dashboard.attendance");
  const locale = useLocale();
  const [value, setValue] = useState(defaultValue);
  const selectedDate = value ? parseISO(value) : undefined;

  return (
    <div className="flex flex-col justify-center">
      <input type="hidden" name={name} value={value} required={required} />
      <Popover>
        <PopoverTrigger
          render={<Button type="button" variant="outline" className="w-full justify-between font-normal" />}
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
    </div>
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

function TimePickerField({ defaultValue = "", name }: { defaultValue?: string; name: string }) {
  const initial = parseTime24(defaultValue);
  const [hour, setHour] = useState<number | null>(initial ? initial.hour : null);
  const [minute, setMinute] = useState<number | null>(initial ? initial.minute : null);
  const [period, setPeriod] = useState<"AM" | "PM">(initial ? initial.period : "AM");

  const value = hour !== null && minute !== null ? formatTime24(hour, minute, period) : "";

  return (
    <div className="flex items-center gap-1.5">
      <input type="hidden" name={name} value={value} />
      <Select value={hour !== null ? String(hour) : ""} onValueChange={(next) => setHour(Number(next))}>
        <SelectTrigger className="w-full">
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
