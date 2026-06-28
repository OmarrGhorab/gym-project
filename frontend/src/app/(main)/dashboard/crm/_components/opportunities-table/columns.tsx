"use client";
"use no memo";

import * as React from "react";

import { useRouter } from "next/navigation";

import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { CalendarIcon, EllipsisVertical } from "lucide-react";
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

const paymentMethodItems = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
] as const;

type SubscriptionAction = "renew" | "freeze" | "stop" | "unfreeze";

function getHealthScore(health: MembershipPipelineRow["health"]) {
  switch (health) {
    case "Active":
      return 18;
    case "Renewed":
      return 15;
    case "Renew Soon":
      return 11;
    case "Needs Action":
      return 7;
    case "Paused":
      return 4;
    default:
      return 0;
  }
}

export const opportunitiesColumns: ColumnDef<MembershipPipelineRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all subscriptions"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label={`Select ${row.original.member}`}
      />
    ),
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <div className="text-sm tracking-tight">#{row.original.subscriptionId}</div>,
    enableHiding: false,
  },
  {
    accessorKey: "member",
    header: "Member",
    cell: ({ row }) => <div className="font-medium text-sm">{row.original.member}</div>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="outline" className="rounded-full px-2.5">
        {row.original.status}
      </Badge>
    ),
    filterFn: "equalsString",
  },
  {
    accessorKey: "plan",
    header: "Plan",
    cell: ({ row }) => <div className="text-sm">{row.original.plan}</div>,
  },
  {
    accessorKey: "health",
    header: "Health",
    cell: ({ row }) => (
      <div className="grid gap-1" title={row.original.healthReason}>
        <div className="flex items-end gap-0.5">
          <span className="sr-only">{row.original.health}</span>
          {healthStripSlots.map((slot) => (
            <div
              key={`${row.original.id}-${slot.id}`}
              className={cn(
                "h-5 w-1 rounded-full",
                slot.threshold <= getHealthScore(row.original.health) ? "bg-green-500/85" : "bg-green-500/15",
              )}
            />
          ))}
        </div>
        <span className="text-muted-foreground text-xs">{row.original.health}</span>
      </div>
    ),
    filterFn: "equalsString",
  },
  {
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => (
      <div className="font-medium text-sm tabular-nums">
        {formatCurrency(row.original.value, { currency: "EGP", noDecimals: true })}
      </div>
    ),
  },
  {
    accessorKey: "balance",
    header: "Balance",
    cell: ({ row }) => (
      <div className="font-medium text-sm tabular-nums">
        {formatCurrency(row.original.balance, { currency: "EGP", noDecimals: true })}
      </div>
    ),
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <SubscriptionActions subscription={row.original} />
      </div>
    ),
    enableHiding: false,
  },
];

function SubscriptionActions({ subscription }: { subscription: MembershipPipelineRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<"stop" | "unfreeze" | null>(null);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [dialogMode, setDialogMode] = React.useState<"details" | "renew" | "freeze">("details");
  const [paymentMethod, setPaymentMethod] = React.useState<"cash" | "card" | "bank_transfer">("cash");
  const [freezeStartDate, setFreezeStartDate] = React.useState(() => getTodayDateString());
  const [freezeEndDate, setFreezeEndDate] = React.useState(() => getTodayDateString());
  const backendActions = getBackendActions(subscription.status);
  const freezeDisabledReason =
    subscription.maxFreezeDays < 1 ? "This plan does not allow subscription freeze days." : null;
  const fieldId = (name: string) => `subscription-${subscription.subscriptionId}-${name}`;
  const confirmActionLabel = getConfirmActionLabel(confirmAction, pendingAction);

  async function submitRenew(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const amount = String(formData.get("amount") ?? "").trim();
    const discount = String(formData.get("discount") ?? "").trim();

    if (!amount || Number(amount) <= 0) {
      toast.error("Payment amount is required.");
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
      toast.error("Freeze start and end dates are required.");
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
        toast.error("Freeze unavailable", { description: freezeDisabledReason });
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
      toast.error("Action failed", { description: result.message });
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
          <span className="sr-only">Open subscription actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => {
              setDialogMode("details");
              setOpen(true);
            }}
          >
            View details
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
                    toast.error("Freeze unavailable", { description: disabledReason });
                    return;
                  }

                  if (pendingAction === null) {
                    void runAction(action);
                  }
                }}
              >
                {pendingAction === action ? "Working..." : getActionMenuLabel(action, disabledReason)}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Subscription #{subscription.subscriptionId}</DialogTitle>
            <DialogDescription>{getDialogDescription(dialogMode)}</DialogDescription>
          </DialogHeader>

          {dialogMode === "details" ? (
            <div className="grid gap-3">
              <DetailRow label="Member" value={subscription.member} />
              <DetailRow label="Member ID" value={subscription.memberId ? `#${subscription.memberId}` : "Not linked"} />
              <DetailRow label="Plan" value={subscription.plan} />
              <DetailRow label="Status" value={subscription.status} />
              <DetailRow label="Health" value={`${subscription.health} - ${subscription.healthReason}`} />
              <DetailRow label="Starts" value={subscription.startDate || "No start date"} />
              <DetailRow label="Ends" value={subscription.endDate || "No end date"} />
              <DetailRow label="Days left" value={`${subscription.daysLeft} day(s)`} />
              <DetailRow
                label="Value"
                value={formatCurrency(subscription.value, { currency: "EGP", noDecimals: true })}
              />
              <DetailRow
                label="Balance"
                value={formatCurrency(subscription.balance, { currency: "EGP", noDecimals: true })}
              />
            </div>
          ) : null}

          {dialogMode === "renew" ? (
            <form className="grid gap-3 rounded-lg border border-border/70 p-3" onSubmit={submitRenew}>
              <div>
                <div className="font-medium text-sm">Renew subscription</div>
                <p className="text-muted-foreground text-xs">
                  Creates the next subscription period and records payment.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm" htmlFor={fieldId("renew-amount")}>
                  Payment amount
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
                  Discount
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
                Payment method
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as "cash" | "card" | "bank_transfer")}
                  items={paymentMethodItems}
                >
                  <SelectTrigger id={fieldId("renew-method")} className="w-full">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {paymentMethodItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pendingAction !== null}>
                  {pendingAction === "renew" ? "Renewing..." : "Renew"}
                </Button>
              </div>
            </form>
          ) : null}

          {dialogMode === "freeze" ? (
            <form className="grid gap-3 rounded-lg border border-border/70 p-3" onSubmit={submitFreeze}>
              <div>
                <div className="font-medium text-sm">Freeze subscription</div>
                <p className="text-muted-foreground text-xs">Freezing extends the end date by the selected days.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <DatePickerField
                  id={fieldId("freeze-start")}
                  label="Freeze start"
                  name="freeze_start"
                  value={freezeStartDate}
                  onChange={setFreezeStartDate}
                />
                <DatePickerField
                  id={fieldId("freeze-end")}
                  label="Freeze end"
                  name="freeze_end"
                  value={freezeEndDate}
                  onChange={setFreezeEndDate}
                />
              </div>
              <label className="grid gap-1.5 text-sm" htmlFor={fieldId("freeze-reason")}>
                Reason
                <Textarea id={fieldId("freeze-reason")} name="reason" placeholder="Optional note" />
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pendingAction !== null}>
                  {pendingAction === "freeze" ? "Freezing..." : "Freeze"}
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
              {confirmAction ? `${labelAction(confirmAction)} subscription?` : "Confirm action"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction
                ? `This will ${labelAction(confirmAction).toLowerCase()} subscription #${subscription.subscriptionId} for ${subscription.member}.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction !== null}>Cancel</AlertDialogCancel>
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
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedDate = parseDateString(value);

  return (
    <div className="grid gap-1.5 text-sm">
      <span>{label}</span>
      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" className="w-full justify-between font-normal">
              {formatDateLabel(value)}
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

function labelAction(action: string) {
  switch (action) {
    case "renew":
      return "Renew";
    case "freeze":
      return "Freeze";
    case "unfreeze":
      return "Unfreeze";
    case "stop":
      return "Stop";
    default:
      return action;
  }
}

function getActionMenuLabel(action: SubscriptionAction, disabledReason: string | null) {
  if (action === "freeze" && disabledReason) {
    return "Freeze unavailable";
  }

  return labelAction(action);
}

function getConfirmActionLabel(action: "stop" | "unfreeze" | null, pendingAction: string | null) {
  if (pendingAction === action) {
    return "Working...";
  }

  if (action) {
    return labelAction(action);
  }

  return "Confirm";
}

function getDialogDescription(mode: "details" | "renew" | "freeze") {
  switch (mode) {
    case "renew":
      return "Renew this subscription by creating the next period and recording payment.";
    case "freeze":
      return "Freeze this subscription for a selected date range.";
    default:
      return "Read-only subscription details.";
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-3 py-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-right font-medium text-sm">{value}</span>
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

function formatDateLabel(value: string) {
  const date = parseDateString(value);

  if (!date) {
    return "Select date";
  }

  return format(date, "d MMM yyyy");
}

function getBackendActions(status: string): SubscriptionAction[] {
  switch (status) {
    case "Active":
      return ["renew", "freeze", "stop"];
    case "Frozen":
      return ["unfreeze", "stop"];
    case "Expired":
      return ["renew"];
    case "Stopped":
      return ["renew"];
    default:
      return [];
  }
}
