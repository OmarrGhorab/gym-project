"use client";

import * as React from "react";

import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { FieldError } from "@/components/ui/field";
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
  "aria-label"?: string;
  className?: string;
  contentClassName?: string;
  defaultValue?: string | number | null;
  disabled?: boolean;
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

export function FormSelect({
  "aria-label": ariaLabel,
  className,
  contentClassName,
  defaultValue,
  disabled = false,
  error,
  id,
  name,
  options,
  placeholder,
  required = false,
  searchPlaceholder,
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
  const t = useTranslations("Dashboard.formControls");
  const initialValue =
    defaultValue === null || defaultValue === undefined || defaultValue === "" ? null : String(defaultValue);
  const isControlled = controlledValue !== undefined;
  const currentValue =
    controlledValue === null || controlledValue === undefined || controlledValue === ""
      ? null
      : String(controlledValue);
  // Always drive Combobox as controlled so Base UI never sees a changing defaultValue
  // when options load/change after mount (common with FormSelect + async option lists).
  const [internalValue, setInternalValue] = React.useState<string | null>(initialValue);
  const [query, setQuery] = React.useState("");
  const value = isControlled ? currentValue : internalValue;
  const selectedOption = React.useMemo(() => {
    if (!value) {
      return null;
    }

    return (
      options.find((option) => option.value === value) ?? {
        label: controlledSelectedLabel ?? value,
        value,
      }
    );
  }, [controlledSelectedLabel, options, value]);

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
    <Combobox
      autoHighlight
      disabled={disabled}
      id={id}
      isItemEqualToValue={(left, right) => left?.value === right?.value}
      itemToStringLabel={(option) => getOptionSearchText(option?.label)}
      itemToStringValue={(option) => option?.value ?? ""}
      items={options}
      name={name}
      onInputValueChange={(nextQuery) => setQuery(nextQuery)}
      onValueChange={(option) => {
        const nextValue = option?.value ?? "";

        if (!isControlled) {
          setInternalValue(option?.value ?? null);
        }

        onOptionSelect?.(option ?? null);
        onValueChange?.(nextValue);
      }}
      required={required}
      value={selectedOption}
    >
      <ComboboxInput
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        aria-label={ariaLabel ?? placeholder ?? t("selectOption")}
        className={cn("w-full", size === "sm" && "h-7", className)}
        placeholder={placeholder ?? searchPlaceholder ?? t("selectOption")}
        showClear={Boolean(value)}
        showTrigger
      />
      <ComboboxContent
        align="start"
        className={contentClassName}
        collisionAvoidance={contentCollisionAvoidance}
        side={contentSide}
      >
        <ComboboxList>
          {options.map((option) => (
            <ComboboxItem key={option.key ?? option.value} value={option}>
              {option.label}
            </ComboboxItem>
          ))}
        </ComboboxList>
        <ComboboxEmpty>{t("noResults")}</ComboboxEmpty>
      </ComboboxContent>
      <FieldError id={errorId} className="pt-1">
        {error}
      </FieldError>
    </Combobox>
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
  "aria-label"?: string;
  className?: string;
  defaultValue?: string | null;
  disabled?: boolean;
  error?: string;
  id?: string;
  name: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value?: string | null;
};

export function FormDatePicker({
  "aria-label": ariaLabel,
  className,
  defaultValue = "",
  disabled = false,
  error,
  id,
  name,
  onValueChange,
  placeholder,
  required = false,
  value: controlledValue,
}: FormDatePickerProps) {
  const errorId = React.useId();
  const locale = useLocale();
  const t = useTranslations("Dashboard.formControls");
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const value = isControlled ? (controlledValue ?? "") : internalValue;
  const selectedDate = parseDateString(value);

  return (
    <>
      <input type="hidden" name={name} value={value} required={required} disabled={disabled} />
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn("w-full justify-between font-normal", className)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              aria-label={ariaLabel ?? placeholder ?? t("selectDate")}
            />
          }
        >
          {selectedDate
            ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(selectedDate)
            : (placeholder ?? t("selectDate"))}
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
  "aria-label"?: string;
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
  "aria-label": ariaLabel,
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
  const t = useTranslations("Dashboard.formControls");
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
        <SelectTrigger
          id={id ? `${id}-hour` : undefined}
          className="w-full"
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          aria-label={ariaLabel ? `${ariaLabel}: ${t("hour")}` : t("hour")}
        >
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
        <SelectTrigger
          className="w-full"
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          aria-label={ariaLabel ? `${ariaLabel}: ${t("minute")}` : t("minute")}
        >
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
        <SelectTrigger
          id={id ? `${id}-period` : undefined}
          className="w-full"
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          aria-label={ariaLabel ? `${ariaLabel}: ${t("period")}` : t("period")}
        >
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

