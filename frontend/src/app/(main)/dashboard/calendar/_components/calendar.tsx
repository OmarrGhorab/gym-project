"use client";

import * as React from "react";

import { useCalendarController } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import multiMonthPlugin from "@fullcalendar/react/multimonth";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { differenceInCalendarDays, endOfMonth, format, startOfMonth } from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
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
import { Calendar as DatePicker } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "./actions";
import type { CalendarEmployeeOption, CalendarEventType, OperationsCalendarEvent } from "./data";

const views = [
  { value: "dayGridMonth", label: "Month" },
  { value: "timeGridWeek", label: "Week" },
  { value: "timeGridDay", label: "Day" },
  { value: "listWeek", label: "List" },
] as const;

const calendars = [
  { value: "all", label: "All gym ops" },
  { value: "shift", label: "Staff shifts" },
  { value: "class", label: "Classes" },
  { value: "pt_session", label: "PT sessions" },
  { value: "renewal", label: "Membership renewals" },
  { value: "payroll", label: "Payroll" },
  { value: "attendance", label: "Attendance review" },
  { value: "inventory", label: "Inventory" },
  { value: "maintenance", label: "Maintenance" },
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

const typeColors: Record<CalendarEventType, string> = {
  manual: "#64748b",
  shift: "#2563eb",
  class: "#16a34a",
  pt_session: "#059669",
  maintenance: "#d97706",
  renewal: "#7c3aed",
  payroll: "#9333ea",
  attendance: "#dc2626",
  inventory: "#ca8a04",
  finance: "#0891b2",
};

const plugins = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, multiMonthPlugin];

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
  };
  classNames?: string;
};

export function Calendar({ events, employees }: CalendarProps) {
  const t = useTranslations("Dashboard.calendar");
  const locale = useLocale();
  const controller = useCalendarController();
  const [eventCount, setEventCount] = React.useState(0);
  const [selectedCalendar, setSelectedCalendar] = React.useState("all");
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
  const editableEvents = events.filter((event) => event.editable).length;
  const generatedEvents = events.length - editableEvents;

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

          <div className="flex flex-wrap items-center gap-2">
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
              <Button size="icon" variant="outline" onClick={() => controller.prev()}>
                <ChevronLeft />
              </Button>
              <Button variant="outline" onClick={() => controller.today()}>
                {t("today")}
              </Button>
              <Button size="icon" variant="outline" onClick={() => controller.next()}>
                <ChevronRight />
              </Button>
            </ButtonGroup>
            <Select
              value={controller.view?.type ?? views[0].value}
              onValueChange={(value) => {
                if (value !== null) controller.changeView(value);
              }}
              items={views}
            >
              <SelectTrigger>
                <SelectValue />
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
          </div>
        </div>

        <EventCalendarViews
          controller={controller}
          initialView={views[0].value}
          plugins={[...plugins]}
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
  const isView = mode === "view";
  const editableEventId = typeof event?.id === "number" ? event.id : null;
  const submitLabel = pending ? t("saving") : getSubmitLabel(mode, t);

  function submit(formData: FormData) {
    startTransition(async () => {
      const result =
        mode === "edit" && editableEventId
          ? await updateCalendarEvent(editableEventId, formData)
          : await createCalendarEvent(formData);

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
            <EventFormFields employees={employees} event={event} locale={locale} />
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
  event,
  locale,
}: {
  employees: CalendarEmployeeOption[];
  event: OperationsCalendarEvent | null;
  locale: string;
}) {
  const t = useTranslations("Dashboard.calendar");
  const initialDate = parseDate(event?.date);
  const [date, setDate] = React.useState<Date | undefined>(initialDate);

  React.useEffect(() => {
    setDate(parseDate(event?.date));
  }, [event]);

  return (
    <>
      <input name="date" type="hidden" value={format(date ?? new Date(), "yyyy-MM-dd")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="calendar-title">{t("title")}</Label>
          <Input
            id="calendar-title"
            name="title"
            required
            defaultValue={event?.title ?? ""}
            placeholder={t("titlePlaceholder")}
          />
        </div>

        <div className="grid gap-2">
          <Label>{t("date")}</Label>
          <Popover>
            <PopoverTrigger
              render={<Button type="button" variant="outline" className="justify-start text-left font-normal" />}
            >
              <CalendarIcon />
              {formatDisplayDate(date ?? new Date(), locale)}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-2">
              <DatePicker mode="single" selected={date} onSelect={setDate} fixedWeeks />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-type">{t("type")}</Label>
          <Select defaultValue={event?.type ?? "manual"} name="type">
            <SelectTrigger id="calendar-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {eventTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {getTypeLabel(type.value, t)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-start">{t("startTime")}</Label>
          <Input id="calendar-start" name="start_time" type="time" defaultValue={timeValue(event?.start)} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-end">{t("endTime")}</Label>
          <Input id="calendar-end" name="end_time" type="time" defaultValue={timeValue(event?.end)} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-status">{t("status")}</Label>
          <Select defaultValue={event?.status ?? "scheduled"} name="status">
            <SelectTrigger id="calendar-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {statuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {t(`statuses.${status.value}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-employee">{t("assignedEmployee")}</Label>
          <Select
            defaultValue={event?.assigned_employee?.id ? String(event.assigned_employee.id) : "none"}
            name="assigned_employee_id"
          >
            <SelectTrigger id="calendar-employee" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none">{t("noEmployee")}</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={String(employee.id)}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="calendar-location">{t("location")}</Label>
          <Input
            id="calendar-location"
            name="location"
            defaultValue={event?.location ?? ""}
            placeholder={t("locationPlaceholder")}
          />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="calendar-notes">{t("notes")}</Label>
          <Textarea
            id="calendar-notes"
            name="notes"
            defaultValue={event?.notes ?? ""}
            placeholder={t("notesPlaceholder")}
          />
        </div>
      </div>
    </>
  );
}

function GeneratedEventDetails({ event, locale }: { event: OperationsCalendarEvent; locale: string }) {
  const t = useTranslations("Dashboard.calendar");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{getTypeLabel(event.type, t)}</Badge>
        <Badge variant={event.status === "cancelled" ? "destructive" : "outline"}>
          {getStatusLabel(event.status, t)}
        </Badge>
      </div>
      <div className="grid gap-3 rounded-md border bg-muted/20 p-4 text-sm">
        <DetailLine icon={<CalendarIcon />} label={t("date")} value={formatEventDate(event, locale)} />
        {event.assigned_employee ? (
          <DetailLine
            icon={<Pencil />}
            label={t("employee")}
            value={`${event.assigned_employee.name}${event.assigned_employee.role ? ` · ${event.assigned_employee.role}` : ""}`}
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
