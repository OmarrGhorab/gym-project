"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function AttendanceDayPicker({ selectedDate }: { selectedDate: string }) {
  const t = useTranslations("Dashboard.attendance");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseISO(selectedDate), [selectedDate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" className="justify-between font-normal" />}>
        <span>
          {t("selectedAttendanceDay")}:{" "}
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
          onSelect={(date) => {
            if (!date) {
              return;
            }

            router.push(`/dashboard/attendance?date=${format(date, "yyyy-MM-dd")}`);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
