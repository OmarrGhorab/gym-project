"use client";

import * as React from "react";

import { format, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function parsePayrollMonth(month: string) {
  const parsed = parse(`${month}-01`, "yyyy-MM-dd", new Date());

  return isValid(parsed) ? parsed : new Date();
}

export function PayrollMonthPicker({ defaultMonth }: { defaultMonth: string }) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(() => parsePayrollMonth(defaultMonth));

  return (
    <div className="flex flex-col gap-1">
      <input name="month" type="hidden" value={format(date, "yyyy-MM")} readOnly />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button id="month" type="button" variant="outline" className="w-48 justify-between font-normal" />}
        >
          {format(date, "MMMM yyyy")}
          <CalendarIcon data-icon="inline-end" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date}
            month={date}
            onMonthChange={setDate}
            onSelect={(value) => {
              if (!value) {
                return;
              }

              setDate(value);
              setOpen(false);
            }}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
