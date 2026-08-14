"use client";

import * as React from "react";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { FormDatePicker } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { type AbsenceFormState, deleteEmployeeAbsence, saveEmployeeAbsence } from "./actions";
import type { AbsenceEmployee, EmployeeAbsence } from "./data";

const initialState: AbsenceFormState = {
  ok: false,
  message: "",
  errors: {},
  values: {},
};

export function AbsenceEditorDialog({
  absence,
  defaultDate,
  employee,
  locked = false,
  monthEnd,
  monthStart,
}: {
  absence?: EmployeeAbsence;
  defaultDate: string;
  employee: AbsenceEmployee;
  locked?: boolean;
  monthEnd: string;
  monthStart: string;
}) {
  const t = useTranslations("Dashboard.absences");
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = React.useActionState(saveEmployeeAbsence, initialState);
  const [deduct, setDeduct] = React.useState(() => Number(absence?.deduction_amount ?? 0) > 0);
  const handledState = React.useRef<AbsenceFormState | null>(null);
  const formKey = absence?.id ?? `new-${employee.id}`;

  React.useEffect(() => {
    if (!state.message || handledState.current === state) {
      return;
    }

    handledState.current = state;

    if (state.ok) {
      toast.success(absence ? t("updated") : t("recorded"));
      setOpen(false);
      return;
    }

    toast.error(t("saveFailed"), { description: state.message });
  }, [absence, state, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={absence ? "outline" : "default"} disabled={locked} />}>
        {absence ? <Pencil /> : <Plus />}
        {absence ? t("edit") : t("addAbsence")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{absence ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("formDescription", { employee: employee.name })}</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4" key={formKey}>
          <input name="absence_id" type="hidden" value={absence?.id ?? ""} />
          <input name="employee_id" type="hidden" value={employee.id} />
          <input name="deduct" type="hidden" value={deduct ? "1" : "0"} />

          {state.message && !state.ok ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
              {state.message}
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor={`absence-date-${formKey}`}>{t("date")}</Label>
            <FormDatePicker
              id={`absence-date-${formKey}`}
              name="date"
              min={monthStart}
              max={monthEnd}
              defaultValue={absence?.date ?? defaultDate}
              disabled={pending}
              required
              error={state.errors.date?.[0]}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`absence-reason-${formKey}`}>{t("reason")}</Label>
            <Textarea
              id={`absence-reason-${formKey}`}
              name="reason"
              maxLength={500}
              defaultValue={absence?.reason ?? ""}
              placeholder={t("reasonPlaceholder")}
              disabled={pending}
              required
              aria-invalid={Boolean(state.errors.reason?.[0])}
            />
            <FieldError errors={state.errors.reason} />
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor={`absence-deduct-${formKey}`}>{t("deductFromSalary")}</Label>
                <p className="text-muted-foreground text-xs">{t("deductHelp")}</p>
              </div>
              <Switch
                id={`absence-deduct-${formKey}`}
                checked={deduct}
                disabled={pending}
                onCheckedChange={(checked) => setDeduct(checked === true)}
              />
            </div>
            {deduct ? (
              <div className="mt-3 grid gap-2">
                <Label htmlFor={`absence-amount-${formKey}`}>{t("deductionAmount")}</Label>
                <Input
                  id={`absence-amount-${formKey}`}
                  name="deduction_amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={Number(absence?.deduction_amount ?? 0) > 0 ? absence?.deduction_amount : ""}
                  placeholder="0.00"
                  disabled={pending}
                  required
                  aria-invalid={Boolean(state.errors.deduction_amount?.[0])}
                />
                <FieldError errors={state.errors.deduction_amount} />
              </div>
            ) : (
              <input name="deduction_amount" type="hidden" value="0" />
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AbsenceDeleteButton({ absence, locked = false }: { absence: EmployeeAbsence; locked?: boolean }) {
  const t = useTranslations("Dashboard.absences");
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function remove() {
    const input = new FormData();
    input.set("id", String(absence.id));

    startTransition(async () => {
      const result = await deleteEmployeeAbsence(input);

      if (result.ok) {
        toast.success(t("deleted"));
        setOpen(false);
        return;
      }

      toast.error(t("deleteFailed"), { description: result.message });
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button size="sm" variant="ghost" disabled={locked} />}>
        <Trash2 />
        <span className="sr-only">{t("delete")}</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteDescription", { date: absence.date, employee: absence.employee.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={remove}>
            {pending ? t("deleting") : t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
