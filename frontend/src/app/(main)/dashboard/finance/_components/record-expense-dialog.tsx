"use client";

import * as React from "react";
import { useActionState } from "react";

import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";
import { CalendarIcon, ReceiptText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { createExpense, type ExpenseFormState } from "./actions";

const initialExpenseFormState: ExpenseFormState = {
  errors: {},
  ok: false,
  values: {},
};

const customExpenseCategory = "__custom__";

const expenseCategoryOptions = [
  { value: "Rent", labelKey: "expenseCategories.rent" },
  { value: "Utilities", labelKey: "expenseCategories.utilities" },
  { value: "Maintenance", labelKey: "expenseCategories.maintenance" },
  { value: "Equipment", labelKey: "expenseCategories.equipment" },
  { value: "Inventory", labelKey: "expenseCategories.inventory" },
  { value: "Cleaning", labelKey: "expenseCategories.cleaning" },
  { value: "Marketing", labelKey: "expenseCategories.marketing" },
  { value: "Software", labelKey: "expenseCategories.software" },
  { value: "Taxes", labelKey: "expenseCategories.taxes" },
  { value: customExpenseCategory, labelKey: "expenseCategories.other" },
] as const;

function formatDateString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function parseDateString(value: string) {
  if (!value) {
    return undefined;
  }

  const date = parseISO(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function DatePickerField({ defaultValue, error, name }: { defaultValue?: string; error?: string; name: string }) {
  const t = useTranslations("Dashboard.finance");
  const locale = useLocale();
  const [value, setValue] = React.useState(defaultValue ?? formatDateString(new Date()));
  const selectedDate = parseDateString(value);
  const errorId = React.useId();

  return (
    <div className="grid gap-2">
      <Label htmlFor={`${name}-date`} className="font-medium text-sm">
        {t("date")}
      </Label>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id={`${name}-date`}
              type="button"
              variant="outline"
              className="w-full justify-between font-normal"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
            >
              {selectedDate
                ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
                    selectedDate,
                  )
                : t("selectDate")}
              <CalendarIcon data-icon="inline-end" className="text-muted-foreground" />
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
                setValue(formatDateString(date));
              }
            }}
          />
        </PopoverContent>
      </Popover>
      <input name={name} type="hidden" value={value} />
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

export function RecordExpenseDialog() {
  const t = useTranslations("Dashboard.finance");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, submit, pending] = useActionState(createExpense, initialExpenseFormState);
  const handledSuccessStateRef = React.useRef<ExpenseFormState | null>(null);
  const previousCategory = state.values.category ?? "";
  const previousCategoryIsPreset = expenseCategoryOptions.some((option) => option.value === previousCategory);
  const [category, setCategory] = React.useState(
    previousCategory && previousCategoryIsPreset ? previousCategory : expenseCategoryOptions[0].value,
  );
  const [customCategory, setCustomCategory] = React.useState(previousCategoryIsPreset ? "" : previousCategory);
  const submittedCategory = category === customExpenseCategory ? customCategory : category;

  React.useEffect(() => {
    if (!state.ok) {
      return;
    }

    if (handledSuccessStateRef.current === state) {
      return;
    }

    handledSuccessStateRef.current = state;
    toast.success(state.message ?? t("saveExpense"));
    setOpen(false);
    router.refresh();
  }, [router, state, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <ReceiptText data-icon="inline-start" />
        {t("actions.recordExpense")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("actions.recordExpense")}</DialogTitle>
          <DialogDescription>{t("recordExpenseDescription")}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          {state.message && !state.ok ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
              {state.message}
            </div>
          ) : null}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="expense-category" className="font-medium text-sm">
                {t("category")}
              </Label>
              <input name="category" type="hidden" value={submittedCategory} />
              <Select value={category} onValueChange={(value) => setCategory(value || expenseCategoryOptions[0].value)}>
                <SelectTrigger id="expense-category" aria-invalid={Boolean(state.errors.category?.[0])}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{t("expenseCategoryGroup")}</SelectLabel>
                    {expenseCategoryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {category === customExpenseCategory ? (
                <Input
                  value={customCategory}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.value;

                    setCustomCategory(nextValue);
                  }}
                  placeholder={t("customCategoryPlaceholder")}
                  aria-invalid={Boolean(state.errors.category?.[0])}
                />
              ) : null}
              <FieldError errors={state.errors.category} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="expense-amount" className="font-medium text-sm">
                  {t("amount")}
                </Label>
                <Input
                  id="expense-amount"
                  name="amount"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="1500"
                  defaultValue={state.values.amount}
                  aria-invalid={Boolean(state.errors.amount?.[0])}
                />
                <FieldError errors={state.errors.amount} />
              </div>
              <DatePickerField defaultValue={state.values.date} error={state.errors.date?.[0]} name="date" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expense-description" className="font-medium text-sm">
              {t("description")}
            </Label>
            <Textarea
              id="expense-description"
              name="description"
              defaultValue={state.values.description}
              placeholder={t("descriptionPlaceholder")}
              aria-invalid={Boolean(state.errors.description?.[0])}
            />
            <FieldError errors={state.errors.description} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("saveExpense")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
