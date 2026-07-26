"use client";

import * as React from "react";

import { useCalendarController } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { differenceInCalendarDays, endOfMonth, format, startOfMonth } from "date-fns";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { EventCalendarViews } from "@/components/calendar/event-calendar-views";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { FormDatePicker, FormSelect, FormTimePicker } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { type CalendarActionResult, createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "./actions";
import type { CalendarEmployeeOption, CalendarEventType, OperationsCalendarEvent } from "./data";

const views = [
  { value: "dayGridMonth", label: "Month" },
  { value: "timeGridWeek", label: "Week" },
  { value: "timeGridDay", label: "Day" },
  { value: "listWeek", label: "List" },
] as const;

type CalendarViewValue = (typeof views)[number]["value"];

function isCalendarView(value: string | null | undefined): value is CalendarViewValue {
  return views.some((view) => view.value === value);
}

type CalendarRenderEventArg = {
  event: {
    title: string;
    extendedProps: Record<string, unknown>;
  };
};

function getCalendarExtendedProps(value: Record<string, unknown>): CalendarEventInput["extendedProps"] {
  return {
    source: typeof value.source === "string" ? value.source : "manual",
    status: typeof value.status === "string" ? value.status : "scheduled",
    type: typeof value.type === "string" ? value.type : "manual",
    assignedEmployees: Array.isArray(value.assignedEmployees)
      ? value.assignedEmployees.filter(isAssignedEmployee)
      : undefined,
    location: typeof value.location === "string" ? value.location : null,
    notes: typeof value.notes === "string" ? value.notes : null,
  };
}

function isAssignedEmployee(
  value: unknown,
): value is NonNullable<CalendarEventInput["extendedProps"]["assignedEmployees"]>[number] {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    typeof value.id === "number" &&
    typeof value.name === "string"
  );
}

const calendars = [
  { value: "all", label: "All gym ops" },
  { value: "shift", label: "Staff shifts" },
  { value: "class", label: "Classes" },
  { value: "pt_session", label: "PT sessions" },
  { value: "training", label: "Training" },
  { value: "meeting", label: "Meetings" },
  { value: "sales", label: "Sales" },
  { value: "renewal", label: "Membership renewals" },
  { value: "payroll", label: "Payroll" },
  { value: "attendance", label: "Attendance review" },
  { value: "inventory", label: "Inventory" },
  { value: "maintenance", label: "Maintenance" },
  { value: "cleaning", label: "Cleaning" },
  { value: "finance", label: "Finance" },
  { value: "manual", label: "Custom notes" },
] as const;

const eventTypes = calendars.filter((calendar) => calendar.value !== "all");

const statuses = [
  { value: "scheduled", label: "Scheduled" },
  { value: "done", label: "Done" },
  { value: "delayed", label: "Delayed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type CalendarStatusValue = (typeof statuses)[number]["value"];

function isCalendarStatus(value: string | null | undefined): value is CalendarStatusValue {
  return statuses.some((status) => status.value === value);
}

const typeColors: Record<CalendarEventType, string> = {
  manual: "#64748b",
  shift: "#2563eb",
  class: "#16a34a",
  pt_session: "#059669",
  training: "#0f766e",
  meeting: "#4f46e5",
  sales: "#c2410c",
  maintenance: "#d97706",
  cleaning: "#0ea5e9",
  renewal: "#7c3aed",
  payroll: "#9333ea",
  attendance: "#dc2626",
  inventory: "#ca8a04",
  finance: "#0891b2",
};

const plugins = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin];

type CalendarProps = {
  events: OperationsCalendarEvent[];
  employees: CalendarEmployeeOption[];
};

type CalendarClickInfo = {
  event: {
    id: string;
  };
};

type CalendarEventInput = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  color: string;
  textColor: string;
  editable: boolean;
  extendedProps: {
    type: string;
    status: string;
    source: string;
    notes?: string | null;
    location?: string | null;
    assignedEmployees?: Array<{
      id: number;
      name: string;
      role: string | null;
    }>;
  };
  classNames?: string;
};

export function Calendar({ events, employees }: CalendarProps) {
  const t = useTranslations("Dashboard.calendar");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const controller = useCalendarController();
  const [eventCount, setEventCount] = React.useState(0);
  const [selectedCalendar, setSelectedCalendar] = React.useState("all");
  const [selectedView, setSelectedView] = React.useState<CalendarViewValue>(views[0].value);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit" | "view">("create");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<OperationsCalendarEvent | null>(null);
  const [dateInfo, setDateInfo] = React.useState(() => {
    const now = new Date();

    return {
      title: formatMonthTitle(now, locale),
      days: differenceInCalendarDays(endOfMonth(now), startOfMonth(now)) + 1,
    };
  });

  const filteredEvents = React.useMemo(() => {
    if (selectedCalendar === "all") {
      return events;
    }

    return events.filter((event) => event.type === selectedCalendar);
  }, [events, selectedCalendar]);

  const calendarEvents = React.useMemo(() => filteredEvents.map(toFullCalendarEvent), [filteredEvents]);
  const eventContent = React.useCallback(
    (arg: CalendarRenderEventArg) => {
      const extendedProps = getCalendarExtendedProps(arg.event.extendedProps);

      return (
        <div className={cn("flex h-full min-w-0 flex-col gap-1 overflow-hidden", isRtl && "text-right")}>
          <div className="flex min-w-0 items-start gap-1.5">
            <span className="min-w-0 flex-1 truncate font-medium">{arg.event.title}</span>
          </div>
          <div
            className={cn(
              "flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-tight opacity-90",
              isRtl && "justify-end",
            )}
          >
            {extendedProps.assignedEmployees?.length ? (
              <span className="truncate">
                {extendedProps.assignedEmployees.map((employee) => employee.name).join(", ")}
              </span>
            ) : null}
            {extendedProps.notes ? <span className="truncate">{extendedProps.notes}</span> : null}
          </div>
        </div>
      );
    },
    [isRtl],
  );
  const editableEvents = events.filter((event) => event.editable).length;
  const generatedEvents = events.length - editableEvents;
  const currentView = controller.view?.type ?? selectedView;
  const currentViewLabel = t(`views.${currentView}`);

  React.useEffect(() => {
    if (isCalendarView(controller.view?.type) && controller.view.type !== selectedView) {
      setSelectedView(controller.view.type);
    }
  }, [controller.view?.type, selectedView]);

  function openCreate() {
    setSelectedEvent(null);
    setDialogMode("create");
    setDialogOpen(true);
  }

  function handleEventClick(info: CalendarClickInfo) {
    const event = events.find((item) => String(item.id) === String(info.event.id));

    if (!event) {
      return;
    }

    setSelectedEvent(event);
    setDialogMode(event.editable ? "edit" : "view");
    setDialogOpen(true);
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label={t("metrics.calendarFeed")}
          value={`${events.length}`}
          detail={t("metrics.backendReminders", { count: generatedEvents })}
        />
        <MetricCard label={t("metrics.customOps")} value={`${editableEvents}`} detail={t("metrics.customOpsDetail")} />
        <MetricCard
          label={t("metrics.currentFilter")}
          value={getTypeLabel(selectedCalendar, t)}
          detail={t("metrics.visibleNow", { count: filteredEvents.length })}
        />
      </div>

      <div className="flex flex-col overflow-hidden rounded-md border">
        <div className="flex flex-col gap-4 border-b bg-sidebar p-4 text-sidebar-foreground lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 shrink-0 flex-col gap-1">
            <div className="font-medium text-lg leading-none">{dateInfo.title}</div>
            <p className="text-muted-foreground text-sm">
              {t("daysEvents", { days: dateInfo.days, events: eventCount })}
            </p>
          </div>

          <div className={cn("flex flex-wrap items-center gap-2", isRtl && "justify-end")}>
            {isRtl ? (
              <>
                <Button onClick={openCreate}>
                  <Plus />
                  {t("addEvent")}
                </Button>
                <Select
                  value={currentView}
                  onValueChange={(value) => {
                    if (isCalendarView(value)) {
                      setSelectedView(value);
                      controller.changeView(value);
                    }
                  }}
                  items={views}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <span className="truncate">{currentViewLabel}</span>
                  </SelectTrigger>
                  <SelectContent align="end" alignItemWithTrigger={false}>
                    <SelectGroup>
                      {views.map((view) => (
                        <SelectItem key={view.value} value={view.value}>
                          {t(`views.${view.value}`)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <ButtonGroup>
                  <Button aria-label={t("next")} size="icon" variant="outline" onClick={() => controller.next()}>
                    <ChevronRight />
                  </Button>
                  <Button variant="outline" onClick={() => controller.today()}>
                    {t("today")}
                  </Button>
                  <Button aria-label={t("previous")} size="icon" variant="outline" onClick={() => controller.prev()}>
                    <ChevronLeft />
                  </Button>
                </ButtonGroup>
                <Select
                  value={selectedCalendar}
                  onValueChange={(value) => {
                    if (value !== null) setSelectedCalendar(value);
                  }}
                  items={calendars}
                >
                  <SelectTrigger className="w-full sm:w-52">
                    <CalendarIcon />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" alignItemWithTrigger={false}>
                    <SelectGroup>
                      {calendars.map((calendar) => (
                        <SelectItem key={calendar.value} value={calendar.value}>
                          {getTypeLabel(calendar.value, t)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                <Select
                  value={selectedCalendar}
                  onValueChange={(value) => {
                    if (value !== null) setSelectedCalendar(value);
                  }}
                  items={calendars}
                >
                  <SelectTrigger className="w-full sm:w-52">
                    <CalendarIcon />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false}>
                    <SelectGroup>
                      {calendars.map((calendar) => (
                        <SelectItem key={calendar.value} value={calendar.value}>
                          {getTypeLabel(calendar.value, t)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <ButtonGroup>
                  <Button aria-label={t("previous")} size="icon" variant="outline" onClick={() => controller.prev()}>
                    <ChevronLeft />
                  </Button>
                  <Button variant="outline" onClick={() => controller.today()}>
                    {t("today")}
                  </Button>
                  <Button aria-label={t("next")} size="icon" variant="outline" onClick={() => controller.next()}>
                    <ChevronRight />
                  </Button>
                </ButtonGroup>
                <Select
                  value={currentView}
                  onValueChange={(value) => {
                    if (isCalendarView(value)) {
                      setSelectedView(value);
                      controller.changeView(value);
                    }
                  }}
                  items={views}
                >
                  <SelectTrigger className="w-40">
                    <span className="truncate">{currentViewLabel}</span>
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false}>
                    <SelectGroup>
                      {views.map((view) => (
                        <SelectItem key={view.value} value={view.value}>
                          {t(`views.${view.value}`)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button onClick={openCreate}>
                  <Plus />
                  {t("addEvent")}
                </Button>
              </>
            )}
          </div>
        </div>

        <EventCalendarViews
          controller={controller}
          initialView={views[0].value}
          plugins={[...plugins]}
          eventContent={eventContent}
          popoverCloseContent={() => <XIcon className="size-5 text-muted-foreground group-hover:text-foreground" />}
          events={calendarEvents}
          eventClick={handleEventClick}
          nowIndicator
          datesSet={(info) => {
            setDateInfo({
              title: formatMonthTitle(info.view.currentStart, locale),
              days: differenceInCalendarDays(info.view.currentEnd, info.view.currentStart),
            });
            setEventCount(
              filteredEvents.filter((event) => {
                const start = new Date(event.start ?? event.date);

                return start >= info.start && start < info.end;
              }).length,
            );
          }}
        />
      </div>

      <EventDialog
        employees={employees}
        event={selectedEvent}
        mode={dialogMode}
        open={dialogOpen}
        locale={locale}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border bg-card p-4 text-card-foreground">
      <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide">{label}</div>
      <div className="mt-2 font-semibold text-2xl">{value}</div>
      <div className="text-muted-foreground text-sm">{detail}</div>
    </div>
  );
}

function EventDialog({
  employees,
  event,
  mode,
  open,
  onOpenChange,
  locale,
}: {
  employees: CalendarEmployeeOption[];
  event: OperationsCalendarEvent | null;
  mode: "create" | "edit" | "view";
  open: boolean;
  locale: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Dashboard.calendar");
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Partial<Record<string, string[]>>>({});
  const isView = mode === "view";
  const editableEventId = typeof event?.id === "number" ? event.id : null;
  const submitLabel = pending ? t("saving") : getSubmitLabel(mode, t);

  function submit(formData: FormData) {
    startTransition(async () => {
      const result =
        mode === "edit" && editableEventId
          ? await updateCalendarEvent(editableEventId, formData)
          : await createCalendarEvent(formData);

      setErrors(result.errors ?? {});

      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        return;
      }

      toast.error(t("notSaved"), { description: result.message });
    });
  }

  function removeEvent() {
    if (!editableEventId) {
      return;
    }

    startTransition(async () => {
      const result = await deleteCalendarEvent(editableEventId);

      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        return;
      }

      toast.error(t("notDeleted"), { description: result.message });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("addGymOpsEvent") : event?.title}</DialogTitle>
          <DialogDescription>{isView ? t("generatedDescription") : t("editableDescription")}</DialogDescription>
        </DialogHeader>

        {isView && event ? (
          <GeneratedEventDetails event={event} locale={locale} />
        ) : (
          <form action={submit} className="grid gap-4">
            <EventFormFields employees={employees} errors={errors} event={event} locale={locale} />
            <DialogFooter>
              {mode === "edit" ? (
                <Button type="button" variant="outline" disabled={pending} onClick={removeEvent}>
                  <Trash2 />
                  {t("delete")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventFormFields({
  employees,
  errors,
  event,
  locale,
}: {
  employees: CalendarEmployeeOption[];
  errors: CalendarActionResult["errors"];
  event: OperationsCalendarEvent | null;
  locale: string;
}) {
  const t = useTranslations("Dashboard.calendar");
  const employeeTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const [title, setTitle] = React.useState(event?.title ?? "");
  const [dateValue, setDateValue] = React.useState(event?.date ?? format(new Date(), "yyyy-MM-dd"));
  const [selectedType, setSelectedType] = React.useState<CalendarEventType>(event?.type ?? "manual");
  const [customTypeLabel, setCustomTypeLabel] = React.useState(event?.custom_type_label ?? "");
  const [startTime, setStartTime] = React.useState(timeValue(event?.start));
  const [endTime, setEndTime] = React.useState(timeValue(event?.end));
  const [status, setStatus] = React.useState(event?.status ?? "scheduled");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<string[]>(
    getAssignedEmployees(event).map((employee) => String(employee.id)),
  );
  const [employeeMenuWidth, setEmployeeMenuWidth] = React.useState<number | null>(null);
  const [location, setLocation] = React.useState(event?.location ?? "");
  const [notes, setNotes] = React.useState(event?.notes ?? "");

  const selectedEmployees = React.useMemo(
    () => employees.filter((employee) => selectedEmployeeIds.includes(String(employee.id))),
    [employees, selectedEmployeeIds],
  );

  React.useEffect(() => {
    setTitle(event?.title ?? "");
    setDateValue(event?.date ?? format(new Date(), "yyyy-MM-dd"));
    setSelectedType(event?.type ?? "manual");
    setCustomTypeLabel(event?.custom_type_label ?? "");
    setStartTime(timeValue(event?.start));
    setEndTime(timeValue(event?.end));
    setStatus(event?.status ?? "scheduled");
    setSelectedEmployeeIds(getAssignedEmployees(event).map((employee) => String(employee.id)));
    setLocation(event?.location ?? "");
    setNotes(event?.notes ?? "");
  }, [event]);

  React.useEffect(() => {
    function syncEmployeeMenuWidth() {
      setEmployeeMenuWidth(employeeTriggerRef.current?.offsetWidth ?? null);
    }

    syncEmployeeMenuWidth();
    window.addEventListener("resize", syncEmployeeMenuWidth);

    return () => {
      window.removeEventListener("resize", syncEmployeeMenuWidth);
    };
  }, []);

  function toggleEmployee(employeeId: string, checked: boolean) {
    setSelectedEmployeeIds((current) => {
      if (checked) {
        return current.includes(employeeId) ? current : [...current, employeeId];
      }

      return current.filter((id) => id !== employeeId);
    });
  }

  return (
    <>
      {selectedEmployeeIds.map((employeeId) => (
        <input key={employeeId} name="assigned_employee_ids" type="hidden" value={employeeId} />
      ))}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="calendar-title">{t("title")}</Label>
          <Input
            id="calendar-title"
            name="title"
            required
            value={title}
            onChange={(currentEvent) => setTitle(currentEvent.target.value)}
            placeholder={t("titlePlaceholder")}
            aria-invalid={Boolean(errors?.title?.[0])}
          />
          <FieldError errors={errors?.title} />
        </div>

        <div className="grid gap-2">
          <Label>{t("date")}</Label>
          <FormDatePicker
            name="date"
            value={dateValue}
            onValueChange={setDateValue}
            placeholder={formatDisplayDate(new Date(), locale)}
            error={errors?.date?.[0]}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-type">{t("type")}</Label>
          <FormSelect
            id="calendar-type"
            name="type"
            value={selectedType}
            selectedLabel={getTypeLabel(selectedType, t)}
            options={eventTypes.map((type) => ({ value: type.value, label: getTypeLabel(type.value, t) }))}
            onValueChange={(value) => {
              if (value) {
                setSelectedType(value as CalendarEventType);
              }
            }}
            error={errors?.type?.[0]}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-custom-type">{t("customTypeLabel")}</Label>
          <Input
            id="calendar-custom-type"
            name="custom_type_label"
            value={customTypeLabel}
            onChange={(currentEvent) => setCustomTypeLabel(currentEvent.target.value)}
            placeholder={t("customTypePlaceholder")}
            disabled={selectedType !== "manual"}
            aria-invalid={Boolean(errors?.custom_type_label?.[0])}
          />
          <FieldError errors={errors?.custom_type_label} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-start">{t("startTime")}</Label>
          <FormTimePicker
            name="start_time"
            value={startTime}
            onValueChange={setStartTime}
            error={errors?.start_time?.[0]}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-end">{t("endTime")}</Label>
          <FormTimePicker name="end_time" value={endTime} onValueChange={setEndTime} error={errors?.end_time?.[0]} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-status">{t("status")}</Label>
          <FormSelect
            id="calendar-status"
            name="status"
            value={status}
            selectedLabel={getStatusLabel(status, t)}
            options={statuses.map((item) => ({ value: item.value, label: t(`statuses.${item.value}`) }))}
            onValueChange={(value) => setStatus(isCalendarStatus(value) ? value : "scheduled")}
            error={errors?.status?.[0]}
          />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="calendar-employees">{t("assignedEmployees")}</Label>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  ref={employeeTriggerRef}
                  id="calendar-employees"
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                />
              }
            >
              <span className="truncate">
                {selectedEmployees.length > 0
                  ? selectedEmployees.map((employee) => employee.name).join(", ")
                  : t("noEmployee")}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="p-1"
              style={
                employeeMenuWidth ? { width: `${employeeMenuWidth}px`, minWidth: `${employeeMenuWidth}px` } : undefined
              }
            >
              <div className="max-h-72 overflow-y-auto">
                {employees.map((employee) => {
                  const checked = selectedEmployeeIds.includes(String(employee.id));

                  return (
                    <button
                      key={employee.id}
                      type="button"
                      className="relative flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-hidden transition-colors hover:bg-muted focus-visible:bg-muted"
                      onClick={() => toggleEmployee(String(employee.id), !checked)}
                    >
                      <span className="truncate">{employee.name}</span>
                      <Check className={checked ? "ml-auto size-4 opacity-100" : "ml-auto size-4 opacity-0"} />
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          {selectedEmployees.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedEmployees.map((employee) => (
                <Badge key={employee.id} variant="secondary">
                  {employee.name}
                </Badge>
              ))}
            </div>
          ) : null}
          <FieldError errors={errors?.assigned_employee_ids} />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="calendar-location">{t("location")}</Label>
          <Input
            id="calendar-location"
            name="location"
            value={location}
            onChange={(currentEvent) => setLocation(currentEvent.target.value)}
            placeholder={t("locationPlaceholder")}
            aria-invalid={Boolean(errors?.location?.[0])}
          />
          <FieldError errors={errors?.location} />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="calendar-notes">{t("notes")}</Label>
          <Textarea
            id="calendar-notes"
            name="notes"
            value={notes}
            onChange={(currentEvent) => setNotes(currentEvent.target.value)}
            placeholder={t("notesPlaceholder")}
            aria-invalid={Boolean(errors?.notes?.[0])}
          />
          <FieldError errors={errors?.notes} />
        </div>
      </div>
    </>
  );
}

function GeneratedEventDetails({ event, locale }: { event: OperationsCalendarEvent; locale: string }) {
  const t = useTranslations("Dashboard.calendar");
  const assignedEmployees = getAssignedEmployees(event);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{getEventTypeLabel(event, t)}</Badge>
        <Badge variant={event.status === "cancelled" ? "destructive" : "outline"}>
          {getStatusLabel(event.status, t)}
        </Badge>
      </div>
      <div className="grid gap-3 rounded-md border bg-muted/20 p-4 text-sm">
        <DetailLine icon={<CalendarIcon />} label={t("date")} value={formatEventDate(event, locale)} />
        {assignedEmployees.length > 0 ? (
          <DetailLine
            icon={<Pencil />}
            label={t("assignedEmployees")}
            value={assignedEmployees
              .map((employee) => `${employee.name}${employee.role ? ` · ${employee.role}` : ""}`)
              .join(", ")}
          />
        ) : null}
        {event.location ? <DetailLine icon={<MapPin />} label={t("location")} value={event.location} /> : null}
        {event.notes ? <DetailLine icon={<Clock />} label={t("notes")} value={event.notes} /> : null}
      </div>
      <DialogFooter showCloseButton />
    </div>
  );
}

function DetailLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground [&>svg]:size-4">{icon}</span>
      <div>
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}

function toFullCalendarEvent(event: OperationsCalendarEvent): CalendarEventInput {
  const color = typeColors[event.type] ?? typeColors.manual;

  return {
    id: String(event.id),
    title: event.title,
    start: event.start ?? event.date,
    end: event.end ?? undefined,
    allDay: event.all_day,
    color,
    textColor: "#ffffff",
    editable: event.editable,
    extendedProps: {
      type: event.type,
      status: event.status,
      source: event.source,
      notes: event.notes,
      location: event.location,
      assignedEmployees: getAssignedEmployees(event),
    },
    classNames: cn(event.status === "cancelled" && "opacity-60"),
  };
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(`${value}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function timeValue(value: string | null | undefined) {
  if (!value?.includes("T")) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return format(parsed, "HH:mm");
}

function formatDisplayDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatMonthTitle(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
}

function formatEventDate(event: OperationsCalendarEvent, locale: string) {
  const date = parseDate(event.date);
  const start = timeValue(event.start);
  const end = timeValue(event.end);

  if (!start) {
    return formatDisplayDate(date, locale);
  }

  return `${formatDisplayDate(date, locale)} · ${start}${end ? `-${end}` : ""}`;
}

function getTypeLabel(value: string, t: ReturnType<typeof useTranslations<"Dashboard.calendar">>) {
  if (value in typeColors || value === "all") {
    return t(`types.${value as CalendarEventType | "all"}`);
  }

  return t("types.fallback");
}

function getEventTypeLabel(
  event: Pick<OperationsCalendarEvent, "type" | "custom_type_label">,
  t: ReturnType<typeof useTranslations<"Dashboard.calendar">>,
) {
  if (event.type === "manual" && event.custom_type_label?.trim()) {
    return event.custom_type_label;
  }

  return getTypeLabel(event.type, t);
}

function getAssignedEmployees(event: OperationsCalendarEvent | null) {
  if (!event) {
    return [];
  }

  if (event.assigned_employees.length > 0) {
    return event.assigned_employees;
  }

  return event.assigned_employee ? [event.assigned_employee] : [];
}

function getStatusLabel(value: string, t: ReturnType<typeof useTranslations<"Dashboard.calendar">>) {
  if (statuses.some((status) => status.value === value)) {
    return t(`statuses.${value as (typeof statuses)[number]["value"]}`);
  }

  return value;
}

function getSubmitLabel(mode: "create" | "edit" | "view", t: ReturnType<typeof useTranslations<"Dashboard.calendar">>) {
  if (mode === "edit") {
    return t("saveChanges");
  }

  return t("createEvent");
}
