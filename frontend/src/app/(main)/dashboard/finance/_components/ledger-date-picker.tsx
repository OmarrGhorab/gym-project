"use client";

import { useState } from "react";

import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function LedgerDatePicker({ locale, name, value }: { locale: string; name: string; value: string }) {
  const t = useTranslations("Dashboard.finance");
  const [selectedValue, setSelectedValue] = useState(value);
  const selectedDate = parseDateString(selectedValue);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" className="h-9 w-full justify-between font-normal">
            {selectedDate
              ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(
                  selectedDate,
                )
              : t("selectDate")}
            <CalendarIcon className="size-4 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-auto overflow-hidden p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          onSelect={(date) => {
            if (date) {
              setSelectedValue(format(date, "yyyy-MM-dd"));
            }
          }}
        />
      </PopoverContent>
      <input type="hidden" name={name} value={selectedValue} />
    </Popover>
  );
}

function parseDateString(value: string) {
  if (!value) {
    return undefined;
  }

  const date = parseISO(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}
