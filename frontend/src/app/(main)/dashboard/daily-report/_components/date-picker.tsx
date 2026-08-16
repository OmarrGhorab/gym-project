"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Which working day is being read.
 *
 * The same picker the attendance day sheet uses, so a date is chosen the same
 * way everywhere in the dashboard — a native date input would drop the browser's
 * own calendar into the middle of a themed page.
 */
export function DailyReportDatePicker({ date }: { date: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => (date ? parseISO(date) : new Date()), [date]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" className="justify-between font-normal" />}>
        <span>
          {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(selected)}
        </span>
        <CalendarIcon data-icon="inline-end" className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto overflow-hidden p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          // A day that has not happened yet has nothing to report.
          disabled={{ after: new Date() }}
          onSelect={(day) => {
            if (!day) {
              return;
            }

            router.push(`/dashboard/daily-report?date=${format(day, "yyyy-MM-dd")}`);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
