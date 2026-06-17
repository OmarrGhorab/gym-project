"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { arEG, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const locales = {
  ar: arEG,
  en: enUS,
};

type DatePickerProps = {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (date: string | undefined) => void;
  placeholder?: string;
  locale?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  portalContainer?: HTMLElement | null;
};

export function DatePicker({
  name,
  defaultValue,
  value,
  onChange,
  placeholder = "Pick a date",
  locale = "en",
  className,
  disabled,
  id,
  portalContainer,
}: DatePickerProps) {
  const dateLocale = locales[locale as keyof typeof locales] ?? enUS;
  const [isOpen, setIsOpen] = React.useState(false);
  const isControlled = value !== undefined;

  const [internalValue, setInternalValue] = React.useState<string | undefined>(
    value ?? defaultValue
  );

  const currentValue = isControlled ? value : internalValue;

  const selectedDate = React.useMemo(() => {
    return currentValue ? parseISO(currentValue) : undefined;
  }, [currentValue]);

  function handleSelect(date: Date | undefined) {
    const dateStr = date ? format(date, "yyyy-MM-dd") : undefined;
    setInternalValue(dateStr);
    onChange?.(dateStr);
    setIsOpen(false);
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-start gap-2 bg-card px-3 text-left text-sm font-normal",
              !selectedDate && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedDate
                ? format(selectedDate, "PPP", { locale: dateLocale })
                : placeholder}
            </span>
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="w-auto p-0"
        side="bottom"
        container={portalContainer}
      >
        <Calendar
          locale={dateLocale}
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
      {name && (
        <input name={name} type="hidden" value={currentValue ?? ""} readOnly />
      )}
    </Popover>
  );
}
