"use client";

import * as React from "react";

import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FormSelectOption = {
  label: React.ReactNode;
  value: string;
};

type FormSelectProps = {
  className?: string;
  contentClassName?: string;
  defaultValue?: string | number | null;
  name: string;
  options: FormSelectOption[];
  placeholder?: string;
  required?: boolean;
  searchPlaceholder?: string;
  onSearchChange?: (query: string) => void;
  size?: "default" | "sm";
};

const emptySelectValue = "__empty__";

export function FormSelect({
  className,
  contentClassName,
  defaultValue,
  name,
  options,
  placeholder,
  required = false,
  searchPlaceholder = "Search...",
  onSearchChange,
  size = "default",
}: FormSelectProps) {
  const initialValue = defaultValue === null || defaultValue === undefined || defaultValue === "" ? emptySelectValue : String(defaultValue);
  const [value, setValue] = React.useState(initialValue);
  const [query, setQuery] = React.useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) => getOptionSearchText(option.label).includes(normalizedQuery))
    : options;
  const selectedLabel =
    value === emptySelectValue
      ? placeholder
      : options.find((option) => option.value === value)?.label ?? placeholder ?? value;

  React.useEffect(() => {
    if (!onSearchChange) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onSearchChange(query);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [onSearchChange, query]);

  return (
    <>
      <input type="hidden" name={name} value={value === emptySelectValue ? "" : value} required={required} />
      <Select value={value} onValueChange={(next) => setValue(next ?? emptySelectValue)}>
        <SelectTrigger className={cn("w-full", className)} size={size}>
          <SelectValue placeholder={placeholder}>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent className={contentClassName}>
          {options.length > 8 ? (
            <div className="sticky top-0 z-10 border-b bg-popover p-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                placeholder={searchPlaceholder}
                className="h-8"
              />
            </div>
          ) : null}
          <SelectGroup>
            {placeholder ? <SelectItem value={emptySelectValue}>{placeholder}</SelectItem> : null}
            {filteredOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );
}

function getOptionSearchText(label: React.ReactNode): string {
  if (typeof label === "string" || typeof label === "number") {
    return String(label).toLowerCase();
  }

  if (Array.isArray(label)) {
    return label.map(getOptionSearchText).join(" ");
  }

  return "";
}

type FormDatePickerProps = {
  className?: string;
  defaultValue?: string | null;
  name: string;
  placeholder?: string;
  required?: boolean;
};

export function FormDatePicker({ className, defaultValue = "", name, placeholder = "Select date", required = false }: FormDatePickerProps) {
  const locale = useLocale();
  const [value, setValue] = React.useState(defaultValue ?? "");
  const selectedDate = parseDateString(value);

  return (
    <>
      <input type="hidden" name={name} value={value} required={required} />
      <Popover>
        <PopoverTrigger render={<Button type="button" variant="outline" className={cn("w-full justify-between font-normal", className)} />}>
          {selectedDate
            ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(selectedDate)
            : placeholder}
          <CalendarIcon data-icon="inline-end" className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto overflow-hidden p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            captionLayout="dropdown"
            onSelect={(date) => {
              if (date) {
                setValue(format(date, "yyyy-MM-dd"));
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}

const timeHours = Array.from({ length: 12 }, (_, index) => index + 1);
const timeMinutes = Array.from({ length: 60 }, (_, index) => index);

type FormTimePickerProps = {
  defaultValue?: string | null;
  name: string;
  required?: boolean;
};

export function FormTimePicker({ defaultValue = "", name, required = false }: FormTimePickerProps) {
  const initial = parseTime24(defaultValue ?? "");
  const [hour, setHour] = React.useState<number | null>(initial?.hour ?? null);
  const [minute, setMinute] = React.useState<number | null>(initial?.minute ?? null);
  const [period, setPeriod] = React.useState<"AM" | "PM">(initial?.period ?? "AM");
  const value = hour !== null && minute !== null ? formatTime24(hour, minute, period) : "";

  return (
    <div className="flex items-center gap-1.5">
      <input type="hidden" name={name} value={value} required={required} />
      <Select value={hour !== null ? String(hour) : ""} onValueChange={(next) => setHour(Number(next))}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {timeHours.map((h) => (
              <SelectItem key={h} value={String(h)}>
                {String(h).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <span className="text-muted-foreground text-sm">:</span>
      <Select value={minute !== null ? String(minute) : ""} onValueChange={(next) => setMinute(Number(next))}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {timeMinutes.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {String(m).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select value={period} onValueChange={(next) => setPeriod(next as "AM" | "PM")}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function parseDateString(value: string) {
  if (!value) {
    return undefined;
  }

  const date = parseISO(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatTime24(hour: number, minute: number, period: "AM" | "PM"): string {
  const normalizedHour = period === "PM" ? (hour % 12) + 12 : hour % 12;

  return `${String(normalizedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTime24(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    return null;
  }

  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return { hour, minute, period };
}
