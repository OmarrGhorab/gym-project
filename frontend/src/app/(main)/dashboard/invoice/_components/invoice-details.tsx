import * as React from "react";

import { format, parseISO } from "date-fns";
import { CalendarIcon, Hash } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { InvoiceFormValues } from "./data";

const dateFields: Array<{
  id: string;
  labelKey: "issuedDate" | "dueDate";
  name: "issuedDate" | "paymentDueDate";
}> = [
  {
    id: "issued-date",
    labelKey: "issuedDate",
    name: "issuedDate",
  },
  {
    id: "payment-due-date",
    labelKey: "dueDate",
    name: "paymentDueDate",
  },
];

export function InvoiceDetails() {
  const t = useTranslations("Dashboard.documents.invoiceBuilder");
  const { control, register } = useFormContext<InvoiceFormValues>();

  return (
    <section className="flex flex-col gap-3">
      <FieldGroup>
        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="reference-number">
            {t("referenceNumber")}
          </FieldLabel>
          <InputGroup>
            <InputGroupInput id="reference-number" {...register("referenceNumber")} />
            <InputGroupAddon align="inline-end">
              <Hash />
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          {dateFields.map((dateField) => (
            <Controller
              key={dateField.name}
              control={control}
              name={dateField.name}
              render={({ field }) => (
                <Field className="gap-1">
                  <FieldLabel className="text-xs" htmlFor={dateField.id}>
                    {t(dateField.labelKey)}
                  </FieldLabel>
                  <DatePicker id={dateField.id} value={field.value} onChange={field.onChange} />
                </Field>
              )}
            />
          ))}
        </div>
      </FieldGroup>
    </section>
  );
}

function DatePicker({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const t = useTranslations("Dashboard.documents.invoiceBuilder");
  const [open, setOpen] = React.useState(false);
  const date = parseDateValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            data-empty={!date}
            className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
          />
        }
      >
        {date ? format(date, "PPP") : <span>{t("pickDate")}</span>}
        <CalendarIcon className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Calendar
          className="w-full"
          mode="single"
          selected={date}
          onSelect={(selectedDate) => {
            if (!selectedDate) return;

            onChange(format(selectedDate, "yyyy-MM-dd"));
            setOpen(false);
          }}
          defaultMonth={date}
        />
      </PopoverContent>
    </Popover>
  );
}

function parseDateValue(value: string) {
  const date = parseISO(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}
