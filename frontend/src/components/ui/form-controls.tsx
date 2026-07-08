"use client";

import * as React from "react";

import { format, parseISO } from "date-fns";
import { CalendarIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FormSelectOption = {
  data?: unknown;
  key?: string;
  label: React.ReactNode;
  value: string;
};

type FormSelectProps = {
  className?: string;
  contentClassName?: string;
  defaultValue?: string | number | null;
  error?: string;
  id?: string;
  name: string;
  options: FormSelectOption[];
  placeholder?: string;
  required?: boolean;
  searchPlaceholder?: string;
  selectedLabel?: React.ReactNode;
  value?: string | number | null;
  contentCollisionAvoidance?: React.ComponentProps<typeof PopoverContent>["collisionAvoidance"];
  contentSide?: React.ComponentProps<typeof PopoverContent>["side"];
  onSearchChange?: (query: string) => void;
  onOptionSelect?: (option: FormSelectOption | null) => void;
  onValueChange?: (value: string) => void;
  size?: "default" | "sm";
};

const emptySelectValue = "__empty__";

export function FormSelect({
  className,
  contentClassName,
  defaultValue,
  error,
  id,
  name,
  options,
  placeholder,
  required = false,
  searchPlaceholder = "Search...",
  selectedLabel: controlledSelectedLabel,
  value: controlledValue,
  contentCollisionAvoidance,
  contentSide = "bottom",
  onSearchChange,
  onOptionSelect,
  onValueChange,
  size = "default",
}: FormSelectProps) {
  const errorId = React.useId();
  const initialValue = defaultValue === null || defaultValue === undefined || defaultValue === "" ? emptySelectValue : String(defaultValue);
  const isControlled = controlledValue !== undefined;
  const currentValue =
    controlledValue === null || controlledValue === undefined || controlledValue === ""
      ? emptySelectValue
      : String(controlledValue);
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(initialValue);
  const [query, setQuery] = React.useState("");
  const [selectedLabelOverride, setSelectedLabelOverride] = React.useState<React.ReactNode>(null);
  const value = isControlled ? currentValue : internalValue;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) => getOptionSearchText(option.label).includes(normalizedQuery))
    : options;
  const selectedLabel: React.ReactNode =
    value === emptySelectValue
      ? placeholder
      : options.find((option) => option.value === value)?.label ??
        controlledSelectedLabel ??
        selectedLabelOverride ??
        placeholder ??
        value;
  const showSearch = options.length > 8 || Boolean(onSearchChange);

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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              size={size}
              className={cn("w-full justify-between bg-transparent px-2.5 font-normal", className)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
          }
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-start",
              value === emptySelectValue && "text-muted-foreground",
            )}
          >
            {selectedLabel}
          </span>
          <ChevronDownIcon data-icon="inline-end" className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn("w-(--anchor-width) gap-0 overflow-hidden p-0", contentClassName)}
          collisionAvoidance={contentCollisionAvoidance}
          side={contentSide}
        >
          {showSearch ? (
            <div className="border-b bg-popover p-2">
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-8"
              />
            </div>
          ) : null}
          <div className="max-h-72 overflow-y-auto p-1">
            {placeholder ? (
              <FormSelectOptionButton
                checked={value === emptySelectValue}
                label={placeholder}
                onSelect={() => {
                  if (!isControlled) {
                    setInternalValue(emptySelectValue);
                  }
                  setSelectedLabelOverride(null);
                  onOptionSelect?.(null);
                  onValueChange?.("");
                  setOpen(false);
                }}
              />
            ) : null}
            {filteredOptions.map((option) => (
              <FormSelectOptionButton
                key={option.key ?? option.value}
                checked={option.value === value}
                label={option.label}
                onSelect={() => {
                  if (!isControlled) {
                    setInternalValue(option.value);
                  }
                  setSelectedLabelOverride(option.label);
                  onOptionSelect?.(option);
                  onValueChange?.(option.value);
                  setOpen(false);
                }}
              />
            ))}
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-3 text-center text-muted-foreground text-sm">No results</div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      <FieldError id={errorId} className="pt-1">
        {error}
      </FieldError>
    </>
  );
}

function FormSelectOptionButton({
  checked,
  label,
  onSelect,
}: {
  checked: boolean;
  label: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
      onClick={onSelect}
    >
      <span className="flex min-w-0 flex-1 truncate">{label}</span>
      {checked ? <CheckIcon className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
    </button>
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
  error?: string;
  id?: string;
  name: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value?: string | null;
};

export function FormDatePicker({
  className,
  defaultValue = "",
  error,
  id,
  name,
  onValueChange,
  placeholder = "Select date",
  required = false,
  value: controlledValue,
}: FormDatePickerProps) {
  const errorId = React.useId();
  const locale = useLocale();
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const value = isControlled ? (controlledValue ?? "") : internalValue;
  const selectedDate = parseDateString(value);

  return (
    <>
      <input type="hidden" name={name} value={value} required={required} />
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn("w-full justify-between font-normal", className)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            />
          }
        >
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
                const nextValue = format(date, "yyyy-MM-dd");
                if (!isControlled) {
                  setInternalValue(nextValue);
                }
                onValueChange?.(nextValue);
              }
            }}
          />
        </PopoverContent>
      </Popover>
      <FieldError id={errorId} className="pt-1">
        {error}
      </FieldError>
    </>
  );
}

const timeHours = Array.from({ length: 12 }, (_, index) => index + 1);
const timeMinutes = Array.from({ length: 60 }, (_, index) => index);

type FormTimePickerProps = {
  className?: string;
  defaultValue?: string | null;
  error?: string;
  id?: string;
  name: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  value?: string | null;
};

export function FormTimePicker({
  className,
  defaultValue = "",
  error,
  id,
  name,
  onValueChange,
  required = false,
  value: controlledValue,
}: FormTimePickerProps) {
  const errorId = React.useId();
  const isControlled = controlledValue !== undefined;
  const initial = parseTime24((controlledValue ?? defaultValue) || "");
  const [hour, setHour] = React.useState<number | null>(initial?.hour ?? null);
  const [minute, setMinute] = React.useState<number | null>(initial?.minute ?? null);
  const [period, setPeriod] = React.useState<"AM" | "PM">(initial?.period ?? "AM");
  const value = hour !== null && minute !== null ? formatTime24(hour, minute, period) : "";

  React.useEffect(() => {
    if (!isControlled) {
      return;
    }

    const parsed = parseTime24(controlledValue ?? "");
    setHour(parsed?.hour ?? null);
    setMinute(parsed?.minute ?? null);
    setPeriod(parsed?.period ?? "AM");
  }, [controlledValue, isControlled]);

  function updateValue(nextHour: number | null, nextMinute: number | null, nextPeriod: "AM" | "PM") {
    const nextValue = nextHour !== null && nextMinute !== null ? formatTime24(nextHour, nextMinute, nextPeriod) : "";
    onValueChange?.(nextValue);
  }

  return (
    <div
      className={cn(
        "grid min-w-[15rem] grid-cols-[minmax(3.75rem,1fr)_auto_minmax(3.75rem,1fr)_minmax(4.25rem,1fr)] items-center gap-1.5",
        className,
      )}
    >
      <input type="hidden" name={name} value={value} required={required} />
      <Select
        value={hour !== null ? String(hour) : ""}
        onValueChange={(next) => {
          const nextHour = Number(next);
          setHour(nextHour);
          updateValue(nextHour, minute, period);
        }}
      >
        <SelectTrigger id={id ? `${id}-hour` : undefined} className="w-full" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}>
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
      <Select
        value={minute !== null ? String(minute) : ""}
        onValueChange={(next) => {
          const nextMinute = Number(next);
          setMinute(nextMinute);
          updateValue(hour, nextMinute, period);
        }}
      >
        <SelectTrigger className="w-full" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}>
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
      <Select
        value={period}
        onValueChange={(next) => {
          const nextPeriod = next as "AM" | "PM";
          setPeriod(nextPeriod);
          updateValue(hour, minute, nextPeriod);
        }}
      >
        <SelectTrigger id={id ? `${id}-period` : undefined} className="w-full" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <FieldError id={errorId} className="col-span-full pt-1">
        {error}
      </FieldError>
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

