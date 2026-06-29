"use client";

import * as React from "react";

import { format, isSameDay, startOfMonth, startOfToday } from "date-fns";
import { enGB } from "date-fns/locale";
import { Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { createOperationsCalendarEvent } from "./actions";
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
  const today = startOfToday();
  const [date, setDate] = React.useState<Date | undefined>(today);
  const [currentMonth, setCurrentMonth] = React.useState<Date>(startOfMonth(today));
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const selectedEvents = events.filter((event) => date && isSameDay(new Date(event.date), date));

  function submitEvent(formData: FormData) {
    startTransition(async () => {
      const result = await createOperationsCalendarEvent(formData);

      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        return;
      }

      toast.error("Event not created", { description: result.message });
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
              <div className="font-medium text-sm">Selected Day</div>
              <div className="text-muted-foreground text-xs">{format(date ?? today, "MMM d, yyyy")}</div>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" />}>
                <Plus data-icon="inline-start" />
                Add
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add gym ops event</DialogTitle>
                  <DialogDescription>Create a custom calendar event for this operations page.</DialogDescription>
                </DialogHeader>
                <form action={submitEvent} className="grid gap-4">
                  <input name="date" type="hidden" value={eventDateValue(date)} />
                  <div className="grid gap-2">
                    <label className="font-medium text-sm" htmlFor="ops-event-title">
                      Title
                    </label>
                    <Input id="ops-event-title" name="title" required placeholder="Staff meeting" />
                  </div>
                  <div className="grid gap-2">
                    <label className="font-medium text-sm" htmlFor="ops-event-type">
                      Type
                    </label>
                    <Select defaultValue="manual" name="type">
                      <SelectTrigger id="ops-event-type" className="w-full">
                        <SelectValue placeholder="Event type" />
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
                    <label className="font-medium text-sm" htmlFor="ops-event-notes">
                      Notes
                    </label>
                    <Textarea id="ops-event-notes" name="notes" placeholder="Optional notes" />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={pending}>
                      {pending ? "Saving..." : "Save event"}
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
                  {event.type}
                  {event.editable ? " · custom" : ""}
                </div>
                {event.notes ? <div className="mt-1 text-muted-foreground text-xs">{event.notes}</div> : null}
              </div>
            ))
          ) : (
            <div className="text-muted-foreground text-xs">No renewal, payroll, or custom events.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
