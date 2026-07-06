"use client";

import { type ReactNode, useActionState, useEffect, useState } from "react";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { type AttendanceActionResult, reviewAttendanceViolation } from "./actions";
import type { AttendanceViolation, EmployeeOption, PaginationMeta } from "./data";

const initialState: AttendanceActionResult = { ok: true, message: "", errors: {}, values: {} };

type Props = {
  employees: EmployeeOption[];
  filters: {
    date: string;
    employeeId: string;
    page: number;
    perPage: string;
    status: string;
    type: string;
  };
  meta: PaginationMeta;
  violations: AttendanceViolation[];
};

export function AttendanceWarningsTable({ employees, filters, meta, violations }: Props) {
  const t = useTranslations("Dashboard.attendance");
  const previousHref = warningPageHref(filters, Math.max(1, meta.current_page - 1));
  const nextHref = warningPageHref(filters, Math.min(meta.last_page, meta.current_page + 1));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="font-normal">{t("reviewWarnings")}</CardTitle>
            <CardDescription>{t("reviewWarningsDescription")}</CardDescription>
          </div>
          <Badge variant="outline" className="w-fit">
            {t("warningTotal", { count: meta.total })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form className="grid gap-3 md:grid-cols-5">
          <input name="date" type="hidden" value={filters.date} />
          <FilterSelect
            defaultValue={filters.status}
            label={t("status")}
            name="warning_status"
            options={[
              { label: t("allStatuses"), value: "all" },
              { label: t("approvalStatuses.pending"), value: "pending" },
              { label: t("approvalStatuses.approved"), value: "approved" },
              { label: t("approvalStatuses.dismissed"), value: "dismissed" },
              { label: t("approvalStatuses.auto_applied"), value: "auto_applied" },
            ]}
          />
          <FilterSelect
            defaultValue={filters.type || "all"}
            label={t("type")}
            name="warning_type"
            options={[
              { label: t("allTypes"), value: "all" },
              { label: formatViolationType("late"), value: "late" },
              { label: formatViolationType("early_leave"), value: "early_leave" },
              { label: formatViolationType("off_shift"), value: "off_shift" },
              { label: formatViolationType("absence"), value: "absence" },
            ]}
          />
          <FilterSelect
            defaultValue={filters.employeeId || "all"}
            label={t("employee")}
            name="warning_employee_id"
            options={[
              { label: t("allEmployees"), value: "all" },
              ...employees.map((employee) => ({ label: employee.name, value: String(employee.id) })),
            ]}
          />
          <FilterSelect
            defaultValue={filters.perPage}
            label={t("rows")}
            name="warning_per_page"
            options={[
              { label: "10", value: "10" },
              { label: "25", value: "25" },
              { label: "50", value: "50" },
            ]}
          />
          <div className="flex items-end gap-2">
            <Button className="flex-1" type="submit" variant="outline">
              {t("applyFilters")}
            </Button>
            <Button
              nativeButton={false}
              render={<a href={`/dashboard/attendance?date=${encodeURIComponent(filters.date)}`} />}
              variant="ghost"
            >
              {t("resetFilters")}
            </Button>
          </div>
        </form>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("rule")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("warningMinutes")}</TableHead>
                <TableHead>{t("deductionDays")}</TableHead>
                <TableHead>{t("deduction")}</TableHead>
                <TableHead className="min-w-56">{t("reviewNotesLabel")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {violations.map((violation) => (
                <TableRow key={violation.id}>
                  <TableCell>
                    <div className="font-medium">{violation.employee?.name ?? t("staff")}</div>
                    <div className="text-muted-foreground text-xs">{violation.violation_date}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{violation.rule?.name ?? formatViolationType(violation.type)}</div>
                    <div className="text-muted-foreground text-xs">{violation.rule?.code ?? violation.type}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={violation.status} />
                  </TableCell>
                  <TableCell>
                    {violation.minutes === null ? t("notAvailable") : t("minutesValue", { count: violation.minutes })}
                  </TableCell>
                  <TableCell>{t("daysValue", { count: Number(violation.deduction_days) })}</TableCell>
                  <TableCell>
                    <div>EGP {violation.estimated_deduction_amount ?? violation.deduction_amount}</div>
                    <div className="text-muted-foreground text-xs">
                      {violation.deduction_amount === "0.00"
                        ? t("deductionAmountPendingHelp")
                        : t("deductionAmountAppliedHelp")}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-56">
                    <InlineWarningActions violation={violation} />
                  </TableCell>
                  <TableCell className="text-right">
                    {violation.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <ReviewButtonForm status="approved" violation={violation} />
                        <ReviewButtonForm status="dismissed" violation={violation} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">--</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {violations.length === 0 ? (
                <TableRow>
                  <TableCell className="h-24 text-center text-muted-foreground text-sm" colSpan={8}>
                    {t("noWarnings")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            {t("warningPageInfo", {
              page: meta.current_page,
              total: meta.total,
            })}
          </p>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  className={meta.current_page <= 1 ? "pointer-events-none opacity-50" : undefined}
                  href={previousHref}
                  text={t("previous")}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  className={meta.current_page >= meta.last_page ? "pointer-events-none opacity-50" : undefined}
                  href={nextHref}
                  text={t("next")}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue: string;
  label: string;
  name: string;
  options: Array<{ label: string; value: string }>;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <input name={name} type="hidden" value={name === "warning_status" || value !== "all" ? value : ""} />
      <Select value={value} onValueChange={(nextValue) => setValue(nextValue ?? defaultValue)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </label>
  );
}

function InlineWarningActions({ violation }: { violation: AttendanceViolation }) {
  return (
    <div className="grid gap-2">
      <input
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        form={`approve-warning-${violation.id}`}
        name="notes"
        placeholder="Review notes"
      />
    </div>
  );
}

function ReviewButtonForm({ status, violation }: { status: "approved" | "dismissed"; violation: AttendanceViolation }) {
  const [state, action] = useActionState(reviewAttendanceViolation, initialState);
  const formId = status === "approved" ? `approve-warning-${violation.id}` : `dismiss-warning-${violation.id}`;
  const amount = status === "approved" ? (violation.estimated_deduction_amount ?? violation.deduction_amount) : "0.00";
  const t = useTranslations("Dashboard.attendance");

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.ok) {
      toast.success(state.message);
    } else {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={action} id={formId}>
      <input name="id" type="hidden" value={violation.id} />
      <input name="status" type="hidden" value={status} />
      <input name="deduction_days" type="hidden" value={status === "approved" ? violation.deduction_days : "0"} />
      <input name="deduction_amount" type="hidden" value={amount} />
      <ReviewSubmitButton
        icon={status === "approved" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
        label={status === "approved" ? t("approve") : t("dismiss")}
        variant={status === "approved" ? "default" : "outline"}
      />
    </form>
  );
}

function ReviewSubmitButton({
  icon,
  label,
  variant,
}: {
  icon: ReactNode;
  label: string;
  variant: "default" | "outline";
}) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} size="sm" type="submit" variant={variant}>
      {icon}
      {label}
    </Button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("Dashboard.attendance");
  let variant: "default" | "outline" | "secondary" = "default";

  if (status === "pending") {
    variant = "secondary";
  } else if (status === "dismissed") {
    variant = "outline";
  }

  return <Badge variant={variant}>{t(`approvalStatuses.${status}`)}</Badge>;
}

function formatViolationType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function warningPageHref(filters: Props["filters"], page: number) {
  const params = new URLSearchParams();
  params.set("date", filters.date);
  params.set("warning_page", String(page));
  params.set("warning_per_page", filters.perPage);

  if (filters.status && filters.status !== "all") {
    params.set("warning_status", filters.status);
  } else if (filters.status === "all") {
    params.set("warning_status", "all");
  }

  if (filters.type) {
    params.set("warning_type", filters.type);
  }

  if (filters.employeeId) {
    params.set("warning_employee_id", filters.employeeId);
  }

  return `/dashboard/attendance?${params.toString()}`;
}
