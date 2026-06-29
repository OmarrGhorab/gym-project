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
  const controller = useCalendarController();
  const [eventCount, setEventCount] = React.useState(0);
  const [selectedCalendar, setSelectedCalendar] = React.useState("all");
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit" | "view">("create");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<OperationsCalendarEvent | null>(null);
  const [dateInfo, setDateInfo] = React.useState(() => {
    const now = new Date();

    return {
      title: format(now, "MMMM yyyy"),
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
        <MetricCard label="Calendar feed" value={`${events.length}`} detail={`${generatedEvents} backend reminders`} />
        <MetricCard label="Custom ops" value={`${editableEvents}`} detail="Editable events created by admin" />
        <MetricCard
          label="Current filter"
          value={getTypeLabel(selectedCalendar)}
          detail={`${filteredEvents.length} visible now`}
        />
      </div>

      <div className="flex flex-col overflow-hidden rounded-md border">
        <div className="flex flex-col gap-4 border-b bg-sidebar p-4 text-sidebar-foreground lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 shrink-0 flex-col gap-1">
            <div className="font-medium text-lg leading-none">{dateInfo.title}</div>
            <p className="text-muted-foreground text-sm">
              {dateInfo.days} days - {eventCount} events
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
                      {calendar.label}
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
                Today
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
                      {view.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button onClick={openCreate}>
              <Plus />
              Add event
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
              title: info.view.title,
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
}: {
  employees: CalendarEmployeeOption[];
  event: OperationsCalendarEvent | null;
  mode: "create" | "edit" | "view";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const isView = mode === "view";
  const editableEventId = typeof event?.id === "number" ? event.id : null;
  const submitLabel = pending ? "Saving..." : getSubmitLabel(mode);

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

      toast.error("Calendar event not saved", { description: result.message });
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

      toast.error("Calendar event not deleted", { description: result.message });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add gym ops event" : event?.title}</DialogTitle>
          <DialogDescription>
            {isView
              ? "This reminder is generated from backend gym data. Manage it from its source page."
              : "Schedule staff work, classes, maintenance, payroll reminders, or custom operations."}
          </DialogDescription>
        </DialogHeader>

        {isView && event ? (
          <GeneratedEventDetails event={event} />
        ) : (
          <form action={submit} className="grid gap-4">
            <EventFormFields employees={employees} event={event} />
            <DialogFooter>
              {mode === "edit" ? (
                <Button type="button" variant="outline" disabled={pending} onClick={removeEvent}>
                  <Trash2 />
                  Delete
                </Button>
              ) : null}
              <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
                Cancel
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
}: {
  employees: CalendarEmployeeOption[];
  event: OperationsCalendarEvent | null;
}) {
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
          <Label htmlFor="calendar-title">Title</Label>
          <Input
            id="calendar-title"
            name="title"
            required
            defaultValue={event?.title ?? ""}
            placeholder="Morning shift coverage"
          />
        </div>

        <div className="grid gap-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger
              render={<Button type="button" variant="outline" className="justify-start text-left font-normal" />}
            >
              <CalendarIcon />
              {format(date ?? new Date(), "MMM d, yyyy")}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-2">
              <DatePicker mode="single" selected={date} onSelect={setDate} fixedWeeks />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-type">Type</Label>
          <Select defaultValue={event?.type ?? "manual"} name="type">
            <SelectTrigger id="calendar-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {eventTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-start">Start time</Label>
          <Input id="calendar-start" name="start_time" type="time" defaultValue={timeValue(event?.start)} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-end">End time</Label>
          <Input id="calendar-end" name="end_time" type="time" defaultValue={timeValue(event?.end)} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-status">Status</Label>
          <Select defaultValue={event?.status ?? "scheduled"} name="status">
            <SelectTrigger id="calendar-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {statuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendar-employee">Assigned employee</Label>
          <Select
            defaultValue={event?.assigned_employee?.id ? String(event.assigned_employee.id) : "none"}
            name="assigned_employee_id"
          >
            <SelectTrigger id="calendar-employee" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="none">No employee</SelectItem>
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
          <Label htmlFor="calendar-location">Location</Label>
          <Input
            id="calendar-location"
            name="location"
            defaultValue={event?.location ?? ""}
            placeholder="Main floor, reception, studio A"
          />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="calendar-notes">Notes</Label>
          <Textarea
            id="calendar-notes"
            name="notes"
            defaultValue={event?.notes ?? ""}
            placeholder="Optional operation notes"
          />
        </div>
      </div>
    </>
  );
}

function GeneratedEventDetails({ event }: { event: OperationsCalendarEvent }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{getTypeLabel(event.type)}</Badge>
        <Badge variant={event.status === "cancelled" ? "destructive" : "outline"}>{event.status}</Badge>
      </div>
      <div className="grid gap-3 rounded-md border bg-muted/20 p-4 text-sm">
        <DetailLine icon={<CalendarIcon />} label="Date" value={formatEventDate(event)} />
        {event.assigned_employee ? (
          <DetailLine
            icon={<Pencil />}
            label="Employee"
            value={`${event.assigned_employee.name}${event.assigned_employee.role ? ` · ${event.assigned_employee.role}` : ""}`}
          />
        ) : null}
        {event.location ? <DetailLine icon={<MapPin />} label="Location" value={event.location} /> : null}
        {event.notes ? <DetailLine icon={<Clock />} label="Notes" value={event.notes} /> : null}
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

function formatEventDate(event: OperationsCalendarEvent) {
  const date = parseDate(event.date);
  const start = timeValue(event.start);
  const end = timeValue(event.end);

  if (!start) {
    return format(date, "MMM d, yyyy");
  }

  return `${format(date, "MMM d, yyyy")} · ${start}${end ? `-${end}` : ""}`;
}

function getTypeLabel(value: string) {
  return calendars.find((calendar) => calendar.value === value)?.label ?? "Gym ops";
}

function getSubmitLabel(mode: "create" | "edit" | "view") {
  if (mode === "edit") {
    return "Save changes";
  }

  return "Create event";
}
