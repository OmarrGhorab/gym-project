import { format, parseISO } from "date-fns";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { StaffAcademyEvent } from "./data";

function eventDate(value: string | null) {
  if (!value) return new Date();

  const date = parseISO(value);

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function UpcomingEvents({ events }: { events: StaffAcademyEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Upcoming Staff Events</CardTitle>
        <CardAction className="flex items-center gap-1 text-muted-foreground text-xs">
          View Calendar <ArrowRight className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
            No upcoming staff events.
          </div>
        ) : (
          events.map((event) => {
            const date = eventDate(event.date);

            return (
              <div key={event.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="size-11 shrink-0 overflow-hidden rounded-sm border">
                    <div className="grid h-1/3 place-items-center border-b bg-muted font-medium text-[10px] uppercase leading-none">
                      {format(date, "MMM")}
                    </div>
                    <div className="grid h-2/3 place-items-center text-lg leading-none">{format(date, "d")}</div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="truncate font-medium text-sm leading-none">{event.title}</div>
                    <div className="text-muted-foreground text-xs leading-none">{event.time}</div>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 rounded-md px-2.5 py-1 font-medium text-[10px]">
                  {event.type}
                </Badge>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
