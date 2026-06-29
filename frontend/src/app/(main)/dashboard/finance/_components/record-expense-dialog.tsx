"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";
import { CalendarIcon, ReceiptText } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

import { createExpense } from "./actions";

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

function DatePickerField({ name }: { name: string }) {
  const [value, setValue] = React.useState(formatDateString(new Date()));
  const selectedDate = parseDateString(value);

  return (
    <div className="grid gap-2">
      <span className="font-medium text-sm">Date</span>
      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" className="w-full justify-between font-normal">
              {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Select date"}
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
    </div>
  );
}

export function RecordExpenseDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createExpense(formData);

      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
        return;
      }

      toast.error("Expense not recorded", { description: result.message });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <ReceiptText data-icon="inline-start" />
        Record expense
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record expense</DialogTitle>
          <DialogDescription>Add an operational cost to the finance ledger.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <span className="font-medium text-sm">Category</span>
              <Input name="category" required placeholder="Rent, utilities, maintenance" />
            </div>
            <div className="grid gap-2">
              <span className="font-medium text-sm">Amount</span>
              <Input name="amount" required type="number" min="0.01" step="0.01" placeholder="1500" />
            </div>
          </div>
          <DatePickerField name="date" />
          <div className="grid gap-2">
            <span className="font-medium text-sm">Description</span>
            <Textarea name="description" placeholder="Optional note" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
