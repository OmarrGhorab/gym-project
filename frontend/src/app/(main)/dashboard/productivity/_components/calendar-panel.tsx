"use client";

import * as React from "react";

import { format, isSameDay, startOfMonth, startOfToday } from "date-fns";
import { enGB } from "date-fns/locale";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { type CreateOperationsCalendarEventResult, createOperationsCalendarEvent } from "./actions";
import type { OperationsCalendarEvent } from "./data";

const eventTypes = [
  { label: "Manual", value: "manual" },
  { label: "Attendance", value: "attendance" },
  { label: "Finance", value: "finance" },
  { label: "Inventory", value: "inventory" },
] as const;

function eventDateValue(date: Date | undefined) {
  return format(date ?? startOfToday(), "yyyy-MM-dd");
}

export function CalendarPanel({ events }: { events: OperationsCalendarEvent[] }) {
  const t = useTranslations("Dashboard.productivity");
  const locale = useLocale();
  const today = startOfToday();
  const [date, setDate] = React.useState<Date | undefined>(today);
  const [currentMonth, setCurrentMonth] = React.useState<Date>(startOfMonth(today));
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<CreateOperationsCalendarEventResult["errors"]>({});
  const selectedEvents = events.filter((event) => date && isSameDay(new Date(event.date), date));

  function submitEvent(formData: FormData) {
    startTransition(async () => {
      const result = await createOperationsCalendarEvent(formData);

      setErrors(result.errors ?? {});

      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        return;
      }

      toast.error(t("eventNotCreated"), { description: result.message });
    });
  }

  return (
    <Card className="w-full" size="sm">
      <CardContent className="flex flex-col gap-4">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          fixedWeeks
          locale={enGB}
          className="w-full p-0"
          modifiers={{
            booked: events.map((event) => new Date(event.date)),
          }}
          modifiersClassNames={{
            booked:
              "after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
          }}
        />
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-sm">{t("selectedDay")}</div>
              <div className="text-muted-foreground text-xs">{formatDisplayDate(date ?? today, locale)}</div>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" />}>
                <Plus data-icon="inline-start" />
                {t("add")}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("addGymOpsEvent")}</DialogTitle>
                  <DialogDescription>{t("createEventDescription")}</DialogDescription>
                </DialogHeader>
                <form action={submitEvent} className="grid gap-4">
                  <input name="date" type="hidden" value={eventDateValue(date)} />
                  <div className="grid gap-2">
                    <label className="font-medium text-sm" htmlFor="ops-event-title">
                      {t("eventTitle")}
                    </label>
                    <Input
                      id="ops-event-title"
                      name="title"
                      required
                      placeholder={t("eventTitlePlaceholder")}
                      aria-invalid={Boolean(errors?.title?.[0])}
                    />
                    <FieldError errors={errors?.title} />
                  </div>
                  <div className="grid gap-2">
                    <label className="font-medium text-sm" htmlFor="ops-event-type">
                      {t("eventType")}
                    </label>
                    <Select defaultValue="manual" name="type">
                      <SelectTrigger id="ops-event-type" className="w-full" aria-invalid={Boolean(errors?.type?.[0])}>
                        <SelectValue placeholder={t("eventTypePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {eventTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {t(`eventTypes.${type.value}`)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldError errors={errors?.type} />
                  </div>
                  <div className="grid gap-2">
                    <label className="font-medium text-sm" htmlFor="ops-event-notes">
                      {t("notes")}
                    </label>
                    <Textarea
                      id="ops-event-notes"
                      name="notes"
                      placeholder={t("notesPlaceholder")}
                      aria-invalid={Boolean(errors?.notes?.[0])}
                    />
                    <FieldError errors={errors?.notes} />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      {t("cancel")}
                    </Button>
                    <Button type="submit" disabled={pending}>
                      {pending ? t("saving") : t("saveEvent")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {selectedEvents.length > 0 ? (
            selectedEvents.slice(0, 5).map((event) => (
              <div key={`${event.type}-${event.title}-${event.id ?? event.date}`} className="rounded-lg border p-2">
                <div className="font-medium text-xs">{event.title}</div>
                <div className="text-muted-foreground text-xs capitalize">
                  {getEventTypeLabel(event.type, t)}
                  {event.editable ? ` · ${t("custom")}` : ""}
                </div>
                {event.notes ? <div className="mt-1 text-muted-foreground text-xs">{event.notes}</div> : null}
              </div>
            ))
          ) : (
            <div className="text-muted-foreground text-xs">{t("noEvents")}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDisplayDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function getEventTypeLabel(type: string, t: ReturnType<typeof useTranslations<"Dashboard.productivity">>) {
  if (eventTypes.some((eventType) => eventType.value === type)) {
    return t(`eventTypes.${type as (typeof eventTypes)[number]["value"]}`);
  }

  return type;
}
