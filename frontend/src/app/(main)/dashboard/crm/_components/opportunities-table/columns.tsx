"use client";
"use no memo";

import * as React from "react";

import { useRouter } from "next/navigation";

import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { CalendarIcon, EllipsisVertical } from "lucide-react";
import type { useTranslations } from "next-intl";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";

import {
  freezeMembershipSubscription,
  renewMembershipSubscription,
  stopMembershipSubscription,
  unfreezeMembershipSubscription,
} from "../actions";
import type { MembershipPipelineRow } from "./schema";

const healthStripSlots = Array.from({ length: 18 }, (_, index) => ({
  id: `strip-${index + 1}`,
  threshold: index + 1,
}));

const paymentMethodItems = [{ value: "cash" }, { value: "card" }, { value: "bank_transfer" }] as const;

type SubscriptionAction = "renew" | "freeze" | "stop" | "unfreeze";
type CrmT = ReturnType<typeof useTranslations<"Dashboard.crm">>;

function getHealthScore(health: MembershipPipelineRow["health"]) {
  switch (health) {
    case "active":
      return 18;
    case "renewed":
      return 15;
    case "renew_soon":
      return 11;
    case "needs_action":
      return 7;
    case "paused":
      return 4;
    default:
      return 0;
  }
}

function getHealthColorClassName(health: MembershipPipelineRow["health"]) {
  switch (health) {
    case "active":
    case "renewed":
      return "bg-green-500/85";
    case "renew_soon":
      return "bg-amber-500/85";
    case "needs_action":
      return "bg-red-500/85";
    case "paused":
      return "bg-slate-500/85";
    default:
      return "bg-muted-foreground/60";
  }
}

function getStatusBadgeClassName(status: string) {
  switch (status) {
    case "active":
      return "border-green-500/35 bg-green-500/10 text-green-700 dark:text-green-300";
    case "expired":
    case "stopped":
      return "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300";
    case "frozen":
      return "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "border-muted-foreground/25 bg-muted/30 text-muted-foreground";
  }
}

function getBillingBadgeClassName(status: string) {
  switch (status) {
    case "paid":
      return "border-green-500/35 bg-green-500/10 text-green-700 dark:text-green-300";
    case "overdue":
      return "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300";
    case "pending":
      return "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "border-muted-foreground/25 bg-muted/30 text-muted-foreground";
  }
}

export function getOpportunitiesColumns(t: CrmT): ColumnDef<MembershipPipelineRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t("selectAllSubscriptions")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t("selectSubscription", { member: row.original.member ?? t("notLinked") })}
        />
      ),
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: t("id"),
      cell: ({ row }) => <div className="text-sm tracking-tight">#{row.original.subscriptionId}</div>,
      enableHiding: false,
    },
    {
      accessorKey: "member",
      header: t("member"),
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <span className="font-medium text-sm">{row.original.member ?? t("notLinked")}</span>
          <span className="text-muted-foreground text-xs">
            {row.original.memberId ? t("memberNumber", { id: row.original.memberId }) : t("notLinked")}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => (
        <Badge variant="outline" className={cn("rounded-full px-2.5", getStatusBadgeClassName(row.original.status))}>
          {translateStatus(row.original.status, t)}
        </Badge>
      ),
      filterFn: "equalsString",
    },
    {
      accessorKey: "plan",
      header: t("plan"),
      cell: ({ row }) => <div className="text-sm">{row.original.plan ?? t("noPlan")}</div>,
    },
    {
      id: "period",
      header: t("period"),
      cell: ({ row }) => (
        <div className="grid gap-0.5 text-sm">
          <span>{formatSubscriptionPeriod(row.original.startDate, row.original.endDate, t)}</span>
          <span className="text-muted-foreground text-xs">{formatDaysLeft(row.original.daysLeft, t)}</span>
        </div>
      ),
    },
    {
      accessorKey: "health",
      header: t("renewalHealth"),
      cell: ({ row }) => (
        <div className="grid gap-1" title={translateHealthReason(row.original, t)}>
          <div className="flex items-end gap-0.5">
            <span className="sr-only">{translateHealth(row.original.health, t)}</span>
            {healthStripSlots.map((slot) => (
              <div
                key={`${row.original.id}-${slot.id}`}
                className={cn(
                  "h-5 w-1 rounded-full",
                  slot.threshold <= getHealthScore(row.original.health)
                    ? getHealthColorClassName(row.original.health)
                    : "bg-muted-foreground/15",
                )}
              />
            ))}
          </div>
          <span className="text-muted-foreground text-xs">{translateHealth(row.original.health, t)}</span>
        </div>
      ),
      filterFn: "equalsString",
    },
    {
      accessorKey: "billingStatus",
      header: t("payment"),
      cell: ({ row }) => (
        <div className="grid gap-1">
          <Badge
            variant="outline"
            className={cn("w-fit rounded-full px-2.5", getBillingBadgeClassName(row.original.billingStatus))}
          >
            {translateBillingStatus(row.original.billingStatus, t)}
          </Badge>
          <span className="text-muted-foreground text-xs">
            {t("paidOfValue", {
              paid: formatCurrency(row.original.paidTotal, { currency: "EGP", noDecimals: true }),
              value: formatCurrency(row.original.value, { currency: "EGP", noDecimals: true }),
            })}
          </span>
        </div>
      ),
      filterFn: "equalsString",
    },
    {
      accessorKey: "value",
      header: t("planPrice"),
      cell: ({ row }) => (
        <div className="font-medium text-sm tabular-nums">
          {formatCurrency(row.original.value, { currency: "EGP", noDecimals: true })}
        </div>
      ),
    },
    {
      accessorKey: "balance",
      header: t("balanceDue"),
      cell: ({ row }) => (
        <div className="font-medium text-sm tabular-nums">
          {formatCurrency(row.original.balance, { currency: "EGP", noDecimals: true })}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">{t("actions")}</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <SubscriptionActions subscription={row.original} t={t} />
        </div>
      ),
      enableHiding: false,
    },
  ];
}

function SubscriptionActions({ subscription, t }: { subscription: MembershipPipelineRow; t: CrmT }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<"stop" | "unfreeze" | null>(null);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [dialogMode, setDialogMode] = React.useState<"details" | "renew" | "freeze">("details");
  const [paymentMethod, setPaymentMethod] = React.useState<"cash" | "card" | "bank_transfer">("cash");
  const [freezeStartDate, setFreezeStartDate] = React.useState(() => getTodayDateString());
  const [freezeEndDate, setFreezeEndDate] = React.useState(() => getTodayDateString());
  const backendActions = getBackendActions(subscription.status);
  const freezeDisabledReason = subscription.maxFreezeDays < 1 ? t("freezeUnavailableReason") : null;
  const fieldId = (name: string) => `subscription-${subscription.subscriptionId}-${name}`;
  const confirmActionLabel = getConfirmActionLabel(confirmAction, pendingAction, t);

  async function submitRenew(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const amount = String(formData.get("amount") ?? "").trim();
    const discount = String(formData.get("discount") ?? "").trim();

    if (!amount || Number(amount) <= 0) {
      toast.error(t("paymentAmountRequired"));
      return;
    }

    setPendingAction("renew");

    const result = await renewMembershipSubscription(subscription.subscriptionId, {
      ...(discount ? { discount } : {}),
      payment: {
        amount,
        method: paymentMethod,
      },
    });

    finishAction(result);
  }

  async function submitFreeze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const freezeStart = String(formData.get("freeze_start") ?? "").trim();
    const freezeEnd = String(formData.get("freeze_end") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();

    if (!freezeStart || !freezeEnd) {
      toast.error(t("freezeDatesRequired"));
      return;
    }

    setPendingAction("freeze");

    const result = await freezeMembershipSubscription(subscription.subscriptionId, {
      freeze_start: freezeStart,
      freeze_end: freezeEnd,
      ...(reason ? { reason } : {}),
    });

    finishAction(result);
  }

  async function runAction(action: string) {
    if (action === "renew" || action === "freeze") {
      if (action === "freeze" && freezeDisabledReason) {
        toast.error(t("freezeUnavailable"), { description: freezeDisabledReason });
        return;
      }

      setDialogMode(action);
      setOpen(true);
      return;
    }

    if (action === "stop" || action === "unfreeze") {
      setConfirmAction(action);
      return;
    }

    await executeDirectAction(action);
  }

  async function executeDirectAction(action: string) {
    setConfirmAction(null);

    setPendingAction(action);

    const result =
      action === "stop"
        ? await stopMembershipSubscription(subscription.subscriptionId)
        : await unfreezeMembershipSubscription(subscription.subscriptionId);

    finishAction(result);
  }

  function finishAction(result: { ok: boolean; message: string }) {
    setPendingAction(null);

    if (!result.ok) {
      toast.error(t("actionFailed"), { description: result.message });
      return;
    }

    toast.success(result.message);
    setDialogMode("details");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-muted-foreground hover:bg-muted focus-visible:bg-muted"
            />
          }
        >
          <EllipsisVertical />
          <span className="sr-only">{t("openSubscriptionActions")}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => {
              setDialogMode("details");
              setOpen(true);
            }}
          >
            {t("viewDetails")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {backendActions.map((action) => {
            const disabledReason = action === "freeze" ? freezeDisabledReason : null;
            const isDisabled = pendingAction !== null || disabledReason !== null;

            return (
              <DropdownMenuItem
                key={action}
                variant={action === "stop" ? "destructive" : "default"}
                data-disabled={isDisabled ? "" : undefined}
                onClick={() => {
                  if (disabledReason) {
                    toast.error(t("freezeUnavailable"), { description: disabledReason });
                    return;
                  }

                  if (pendingAction === null) {
                    void runAction(action);
                  }
                }}
              >
                {pendingAction === action ? t("working") : getActionMenuLabel(action, disabledReason, t)}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("subscriptionTitle", { id: subscription.subscriptionId })}</DialogTitle>
            <DialogDescription>{getDialogDescription(dialogMode, t)}</DialogDescription>
          </DialogHeader>

          {dialogMode === "details" ? (
            <div className="grid gap-3">
              <DetailRow label={t("member")} value={subscription.member ?? t("notLinked")} />
              <DetailRow
                label={t("memberId")}
                value={subscription.memberId ? t("memberNumber", { id: subscription.memberId }) : t("notLinked")}
              />
              <DetailRow label={t("plan")} value={subscription.plan ?? t("noPlan")} />
              <DetailRow label={t("status")} value={translateStatus(subscription.status, t)} />
              <DetailRow label={t("payment")} value={translateBillingStatus(subscription.billingStatus, t)} />
              <DetailRow
                label={t("renewalHealth")}
                value={`${translateHealth(subscription.health, t)} - ${translateHealthReason(subscription, t)}`}
              />
              <DetailRow label={t("starts")} value={subscription.startDate ?? t("noStartDate")} />
              <DetailRow label={t("ends")} value={subscription.endDate ?? t("noEndDate")} />
              <DetailRow label={t("daysLeft")} value={formatDaysLeft(subscription.daysLeft, t)} />
              <DetailRow
                label={t("paidTotal")}
                value={formatCurrency(subscription.paidTotal, { currency: "EGP", noDecimals: true })}
              />
              <DetailRow
                label={t("value")}
                value={formatCurrency(subscription.value, { currency: "EGP", noDecimals: true })}
              />
              <DetailRow
                label={t("balance")}
                value={formatCurrency(subscription.balance, { currency: "EGP", noDecimals: true })}
              />
            </div>
          ) : null}

          {dialogMode === "renew" ? (
            <form className="grid gap-3 rounded-lg border border-border/70 p-3" onSubmit={submitRenew}>
              <div>
                <div className="font-medium text-sm">{t("renewSubscription")}</div>
                <p className="text-muted-foreground text-xs">{t("renewDescription")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm" htmlFor={fieldId("renew-amount")}>
                  {t("paymentAmount")}
                  <Input
                    id={fieldId("renew-amount")}
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={subscription.value || ""}
                  />
                </label>
                <label className="grid gap-1.5 text-sm" htmlFor={fieldId("renew-discount")}>
                  {t("discount")}
                  <Input
                    id={fieldId("renew-discount")}
                    name="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </label>
              </div>
              <div className="grid gap-1.5 text-sm">
                {t("paymentMethod")}
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as "cash" | "card" | "bank_transfer")}
                >
                  <SelectTrigger id={fieldId("renew-method")} className="w-full">
                    <SelectValue placeholder={t("selectPaymentMethod")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {paymentMethodItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {t(`paymentMethods.${item.value}`)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button type="submit" size="sm" disabled={pendingAction !== null}>
                  {pendingAction === "renew" ? t("renewing") : t("renew")}
                </Button>
              </div>
            </form>
          ) : null}

          {dialogMode === "freeze" ? (
            <form className="grid gap-3 rounded-lg border border-border/70 p-3" onSubmit={submitFreeze}>
              <div>
                <div className="font-medium text-sm">{t("freezeSubscription")}</div>
                <p className="text-muted-foreground text-xs">{t("freezeDescription")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <DatePickerField
                  id={fieldId("freeze-start")}
                  label={t("freezeStart")}
                  name="freeze_start"
                  value={freezeStartDate}
                  onChange={setFreezeStartDate}
                  t={t}
                />
                <DatePickerField
                  id={fieldId("freeze-end")}
                  label={t("freezeEnd")}
                  name="freeze_end"
                  value={freezeEndDate}
                  onChange={setFreezeEndDate}
                  t={t}
                />
              </div>
              <label className="grid gap-1.5 text-sm" htmlFor={fieldId("freeze-reason")}>
                {t("reason")}
                <Textarea id={fieldId("freeze-reason")} name="reason" placeholder={t("optionalNote")} />
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button type="submit" size="sm" disabled={pendingAction !== null}>
                  {pendingAction === "freeze" ? t("freezing") : t("freeze")}
                </Button>
              </div>
            </form>
          ) : null}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmAction !== null} onOpenChange={(nextOpen) => !nextOpen && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction ? t("confirmActionTitle", { action: labelAction(confirmAction, t) }) : t("confirmAction")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction
                ? t("confirmActionDescription", {
                    action: labelAction(confirmAction, t).toLowerCase(),
                    id: subscription.subscriptionId,
                    member: subscription.member ?? t("notLinked"),
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction !== null}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmAction === "stop" ? "destructive" : "default"}
              disabled={pendingAction !== null || confirmAction === null}
              onClick={() => {
                if (confirmAction) {
                  void executeDirectAction(confirmAction);
                }
              }}
            >
              {confirmActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DatePickerField({
  id,
  label,
  name,
  value,
  onChange,
  t,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  t: CrmT;
}) {
  const selectedDate = parseDateString(value);

  return (
    <div className="grid gap-1.5 text-sm">
      <span>{label}</span>
      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" className="w-full justify-between font-normal">
              {formatDateLabel(value, t)}
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
                onChange(formatDateString(date));
              }
            }}
          />
        </PopoverContent>
      </Popover>
      <input id={id} name={name} type="hidden" value={value} />
    </div>
  );
}

function labelAction(action: string, t: CrmT) {
  switch (action) {
    case "renew":
      return t("renew");
    case "freeze":
      return t("freeze");
    case "unfreeze":
      return t("unfreeze");
    case "stop":
      return t("stop");
    default:
      return action;
  }
}

function getActionMenuLabel(action: SubscriptionAction, disabledReason: string | null, t: CrmT) {
  if (action === "freeze" && disabledReason) {
    return t("freezeUnavailable");
  }

  return labelAction(action, t);
}

function getConfirmActionLabel(action: "stop" | "unfreeze" | null, pendingAction: string | null, t: CrmT) {
  if (pendingAction === action) {
    return t("working");
  }

  if (action) {
    return labelAction(action, t);
  }

  return t("confirm");
}

function getDialogDescription(mode: "details" | "renew" | "freeze", t: CrmT) {
  switch (mode) {
    case "renew":
      return t("renewDialogDescription");
    case "freeze":
      return t("freezeDialogDescription");
    default:
      return t("detailsDescription");
  }
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-3 py-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-right font-medium text-sm">{value ?? "—"}</span>
    </div>
  );
}

function getTodayDateString() {
  return formatDateString(new Date());
}

function formatDateString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function parseDateString(value: string) {
  try {
    return parseISO(value);
  } catch {
    return undefined;
  }
}

function formatDateLabel(value: string, t: CrmT) {
  const date = parseDateString(value);

  if (!date) {
    return t("selectDate");
  }

  return format(date, "d MMM yyyy");
}

export function translateHealth(value: string, t: CrmT) {
  if (
    value === "active" ||
    value === "renewed" ||
    value === "renew_soon" ||
    value === "needs_action" ||
    value === "paused"
  ) {
    return t(`healthLabels.${value}`);
  }

  return value;
}

export function translateStatus(value: string, t: CrmT) {
  if (value === "active" || value === "frozen" || value === "expired" || value === "stopped" || value === "pending") {
    return t(`statuses.${value}`);
  }

  return value;
}

export function translateBillingStatus(value: string, t: CrmT) {
  if (value === "paid" || value === "pending" || value === "overdue") {
    return t(`billingStatuses.${value}`);
  }

  return value;
}

function translateHealthReason(subscription: MembershipPipelineRow, t: CrmT) {
  if (subscription.healthReason === "next_period_starts") {
    return t("healthReasons.nextPeriodStarts", { date: subscription.startDate ?? t("noStartDate") });
  }

  if (subscription.healthReason === "has_balance") {
    return t("healthReasons.hasBalance");
  }

  if (subscription.healthReason === "expired") {
    return t("healthReasons.expired");
  }

  if (subscription.healthReason === "frozen") {
    return t("healthReasons.frozen");
  }

  if (subscription.healthReason === "stopped") {
    return t("healthReasons.stopped");
  }

  if (subscription.healthReason === "ends_in") {
    return t("healthReasons.endsIn", { count: subscription.daysLeft ?? 0 });
  }

  if (subscription.healthReason === "active_no_balance") {
    return t("healthReasons.activeNoBalance");
  }

  return subscription.healthReason;
}

function getBackendActions(status: string): SubscriptionAction[] {
  switch (status) {
    case "active":
      return ["renew", "freeze", "stop"];
    case "frozen":
      return ["unfreeze", "stop"];
    case "expired":
    case "stopped":
      return ["renew"];
    default:
      return [];
  }
}

function formatSubscriptionPeriod(startDate: string | null, endDate: string | null, t: CrmT) {
  if (!startDate && !endDate) {
    return t("noPeriod");
  }

  return `${startDate ?? t("noStartDate")} - ${endDate ?? t("noEndDate")}`;
}

function formatDaysLeft(daysLeft: number | null, t: CrmT) {
  if (daysLeft === null) {
    return t("noEndDate");
  }

  if (daysLeft < 0) {
    return t("expiredDaysAgo", { count: Math.abs(daysLeft) });
  }

  return t("daysValue", { count: daysLeft });
}
