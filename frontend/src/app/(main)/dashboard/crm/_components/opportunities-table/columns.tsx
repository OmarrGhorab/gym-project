"use client";
"use no memo";

import * as React from "react";

import { useRouter } from "next/navigation";

import type { ColumnDef } from "@tanstack/react-table";
import { addDays, format, parseISO } from "date-fns";
import { CalendarIcon, EllipsisVertical } from "lucide-react";
import type { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
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
import { buildQrImageUrl, buildWhatsAppUrl } from "@/lib/whatsapp";

import {
  addMembershipExtra,
  cancelMembershipSubscription,
  changeMembershipPlan,
  freezeMembershipSubscription,
  recordMembershipPayment,
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

type SubscriptionAction = "renew" | "freeze" | "stop" | "unfreeze" | "cancel";
type CrmT = ReturnType<typeof useTranslations<"Dashboard.crm">>;
type DialogMode = "details" | "renew" | "freeze" | "unfreeze" | "change_plan" | "payment" | "cancel";
type ChangePlanTarget = "main" | "extra";

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
    case "refunded":
      return "border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "partial_refund":
      return "border-orange-500/35 bg-orange-500/10 text-orange-700 dark:text-orange-300";
    case "stopped":
      return "border-slate-500/35 bg-slate-500/10 text-slate-700 dark:text-slate-300";
    default:
      return "border-muted-foreground/25 bg-muted/30 text-muted-foreground";
  }
}

export function getOpportunitiesColumns(
  t: CrmT,
  reminderDays: number[],
  canViewMoney: boolean,
): ColumnDef<MembershipPipelineRow>[] {
  const moneyColumns: ColumnDef<MembershipPipelineRow>[] = canViewMoney
    ? [
        {
          accessorKey: "billingStatus",
          header: t("payment"),
          cell: ({ row }) => {
            const { billingStatus, paidTotal, collectedPaidTotal, refundTotal, value } = row.original;
            const netPaid = paidTotal;
            const grossCollected = Math.max(collectedPaidTotal, netPaid + Math.max(refundTotal, 0));

            return (
              <div className="grid gap-1">
                <Badge
                  variant="outline"
                  className={cn("w-fit rounded-full px-2.5", getBillingBadgeClassName(billingStatus))}
                >
                  {translateBillingStatus(billingStatus, t)}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {t("paidOfValue", {
                    paid: formatCurrency(netPaid, { currency: "EGP", noDecimals: true }),
                    value: formatCurrency(value, { currency: "EGP", noDecimals: true }),
                  })}
                </span>
                {refundTotal > 0 ? (
                  <span className="text-violet-700 text-xs dark:text-violet-300">
                    {t("refundedAmount", {
                      amount: formatCurrency(refundTotal, { currency: "EGP", noDecimals: true }),
                    })}
                    {grossCollected > 0 && refundTotal < grossCollected
                      ? ` · ${t("netAfterRefund", {
                          amount: formatCurrency(netPaid, { currency: "EGP", noDecimals: true }),
                        })}`
                      : null}
                  </span>
                ) : null}
              </div>
            );
          },
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
          accessorKey: "refundTotal",
          header: t("refund"),
          cell: ({ row }) => (
            <div className="font-medium text-sm tabular-nums">
              {row.original.refundTotal > 0
                ? formatCurrency(row.original.refundTotal, { currency: "EGP", noDecimals: true })
                : "—"}
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
      ]
    : [];
  const columns: ColumnDef<MembershipPipelineRow>[] = [
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
      cell: ({ row }) => {
        const isClosed = row.original.status === "stopped" || row.original.status === "expired";
        const wasRefunded = row.original.refundTotal > 0 || row.original.billingStatus === "refunded";

        return (
          <div className="grid gap-0.5 text-sm">
            <span>{formatSubscriptionPeriod(row.original.startDate, row.original.endDate, t)}</span>
            <span className="text-muted-foreground text-xs">
              {isClosed
                ? wasRefunded
                  ? t("periodClosedRefunded")
                  : t("periodClosed")
                : formatDaysLeft(row.original.daysLeft, t)}
            </span>
          </div>
        );
      },
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
    ...moneyColumns,
    {
      id: "actions",
      header: () => <div className="text-right">{t("actions")}</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <SubscriptionActions subscription={row.original} t={t} reminderDays={reminderDays} />
        </div>
      ),
      enableHiding: false,
    },
  ];

  return columns;
}

function SubscriptionActions({
  subscription,
  t,
  reminderDays,
}: {
  subscription: MembershipPipelineRow;
  t: CrmT;
  reminderDays: number[];
}) {
  const router = useRouter();
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<"stop" | null>(null);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("details");
  const [paymentMethod, setPaymentMethod] = React.useState<"cash" | "card" | "bank_transfer">("cash");
  const [freezeStartDate, setFreezeStartDate] = React.useState(() => getTodayDateString());
  const [freezeEndDate, setFreezeEndDate] = React.useState(() => getTodayDateString());
  const [resumeOnDate, setResumeOnDate] = React.useState(() => getTodayDateString());
  const canChangeMainPlan =
    subscription.status === "active" || subscription.status === "expired" || subscription.status === "stopped";
  const canAddExtra = subscription.status === "active";
  const canOpenChangePlan = canChangeMainPlan || canAddExtra;
  const changePlanMode = subscription.status === "active" ? "upgrade" : "renew";
  const mainPlanOptions = subscription.planOptions.filter((plan) => plan.kind === "main");
  const extraPlanOptions = subscription.planOptions.filter((plan) => plan.kind === "extra");
  const defaultMainPlan =
    mainPlanOptions.find((plan) => subscription.status !== "active" || plan.id !== subscription.planId) ??
    mainPlanOptions[0] ??
    null;
  const defaultExtraPlan = extraPlanOptions[0] ?? null;
  const [changePlanTarget, setChangePlanTarget] = React.useState<ChangePlanTarget>("main");
  const [changePlanId, setChangePlanId] = React.useState(() => (defaultMainPlan ? String(defaultMainPlan.id) : ""));
  const [changePlanDiscount, setChangePlanDiscount] = React.useState("0");
  const [changePlanCreditMode, setChangePlanCreditMode] = React.useState<"full_difference" | "day_proration">(
    "full_difference",
  );
  const [changePlanAmountOverride, setChangePlanAmountOverride] = React.useState<string | null>(null);
  const [changePlanCoachId, setChangePlanCoachId] = React.useState(() =>
    subscription.coachOptions[0] ? String(subscription.coachOptions[0].id) : "",
  );
  const [cancelRefundAmount, setCancelRefundAmount] = React.useState(() => subscription.defaultRefundAmount.toFixed(2));
  const backendActions = getBackendActions(subscription.status);
  const availableChangePlans = changePlanTarget === "main" ? mainPlanOptions : extraPlanOptions;
  const selectedChangePlan =
    availableChangePlans.find((plan) => String(plan.id) === changePlanId) ?? availableChangePlans[0] ?? null;
  const selectedChangePlanLabel = selectedChangePlan
    ? formatPlanOptionLabel(selectedChangePlan)
    : changePlanTarget === "main"
      ? t("selectMainPlan")
      : t("selectExtraPlan");
  const changePlanDetails =
    selectedChangePlan && changePlanTarget === "main" && changePlanMode === "upgrade"
      ? calculatePlanChangeDetails({
          creditMode: changePlanCreditMode,
          newPrice: selectedChangePlan.price,
          paidTotal: subscription.paidTotal,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          extraDiscount: changePlanDiscount,
        })
      : null;
  const suggestedChangePlanAmount =
    selectedChangePlan == null
      ? ""
      : changePlanDetails
        ? changePlanDetails.amountDue
        : String(Math.max(0, selectedChangePlan.price - Number(changePlanDiscount || 0)).toFixed(2));
  const changePlanPaymentAmount = changePlanAmountOverride ?? suggestedChangePlanAmount;

  function switchChangePlanTarget(target: ChangePlanTarget) {
    setChangePlanTarget(target);
    setChangePlanAmountOverride(null);
    setChangePlanDiscount("0");

    if (target === "main") {
      setChangePlanId(defaultMainPlan ? String(defaultMainPlan.id) : "");
      return;
    }

    setChangePlanId(defaultExtraPlan ? String(defaultExtraPlan.id) : "");
  }
  const selectedFreezeDays = getInclusiveDays(freezeStartDate, freezeEndDate);
  const freezeEndRange = getFreezeEndRange(freezeStartDate, subscription.minFreezeDays, subscription.maxFreezeDays);
  const isFreezeDurationInvalid =
    selectedFreezeDays === null ||
    (subscription.minFreezeDays > 0 && selectedFreezeDays < subscription.minFreezeDays) ||
    selectedFreezeDays > subscription.maxFreezeDays;
  const freezeDisabledReason = subscription.maxFreezeDays < 1 ? t("freezeUnavailableReason") : null;
  const fieldId = (name: string) => `subscription-${subscription.subscriptionId}-${name}`;
  const confirmActionLabel = getConfirmActionLabel(confirmAction, pendingAction, t);
  const showRenewalReminderAction =
    subscription.status === "active" &&
    subscription.daysLeft !== null &&
    subscription.daysLeft >= 0 &&
    reminderDays.includes(subscription.daysLeft);

  function handleOpenWhatsApp() {
    const url = buildWhatsAppUrl(subscription.memberPhone, buildSubscriptionWhatsAppMessage(subscription, t, locale));

    if (!url) {
      toast.error(t("whatsAppPhoneMissing"));
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleOpenRenewalReminderWhatsApp() {
    const url = buildWhatsAppUrl(
      subscription.memberPhone,
      buildSubscriptionReminderWhatsAppMessage(subscription, t, locale, reminderDays),
    );

    if (!url) {
      toast.error(t("whatsAppPhoneMissing"));
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function updateFreezeStartDate(value: string) {
    setFreezeStartDate(value);

    const nextRange = getFreezeEndRange(value, subscription.minFreezeDays, subscription.maxFreezeDays);

    if (nextRange) {
      setFreezeEndDate(clampDateString(freezeEndDate, nextRange.from, nextRange.to));
    }
  }

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

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const amount = String(formData.get("amount") ?? "").trim();

    if (!amount || Number(amount) <= 0) {
      toast.error(t("paymentAmountRequired"));
      return;
    }

    setPendingAction("payment");

    const result = await recordMembershipPayment({
      subscription_id: subscription.subscriptionId,
      amount,
      method: paymentMethod,
    });

    finishAction(result);
  }

  async function submitChangePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const planId = Number(formData.get("plan_id"));
    const amount = String(formData.get("amount") ?? "").trim();
    const discount = String(formData.get("discount") ?? "").trim();
    const creditMode = String(formData.get("credit_mode") ?? "full_difference") as "full_difference" | "day_proration";
    const coachId = Number(formData.get("coach_id") || 0);

    if (!planId || !amount || Number(amount) < 0) {
      toast.error(t("paymentAmountRequired"));
      return;
    }

    setPendingAction("change_plan");

    if (changePlanTarget === "extra") {
      if (subscription.status !== "active") {
        toast.error(t("extraRequiresActiveMembership"));
        setPendingAction(null);
        return;
      }

      const result = await addMembershipExtra(subscription.subscriptionId, {
        plan_id: planId,
        ...(coachId > 0 ? { coach_id: coachId } : {}),
        ...(discount ? { discount } : {}),
        payment: {
          amount,
          method: paymentMethod,
        },
      });

      finishAction(result);
      return;
    }

    const result = await changeMembershipPlan(
      subscription.subscriptionId,
      {
        plan_id: planId,
        ...(changePlanMode === "upgrade"
          ? {
              credit_mode: creditMode,
              amount_due: amount,
            }
          : {}),
        ...(discount ? { discount } : {}),
        payment: {
          amount,
          method: paymentMethod,
        },
      },
      changePlanMode,
    );

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

    const freezeDays = getInclusiveDays(freezeStart, freezeEnd);

    if (subscription.minFreezeDays > 0 && freezeDays !== null && freezeDays < subscription.minFreezeDays) {
      toast.error(t("freezeTooShort", { min: subscription.minFreezeDays, selected: freezeDays }));
      return;
    }

    if (freezeDays !== null && freezeDays > subscription.maxFreezeDays) {
      toast.error(t("freezeTooLong", { max: subscription.maxFreezeDays, selected: freezeDays }));
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

  async function submitUnfreeze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const resumeOn = String(formData.get("resume_on") ?? "").trim();

    if (!resumeOn) {
      toast.error(t("resumeDateRequired"));
      return;
    }

    setPendingAction("unfreeze");

    const result = await unfreezeMembershipSubscription(subscription.subscriptionId, {
      resume_on: resumeOn,
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

    if (action === "unfreeze") {
      setDialogMode("unfreeze");
      setOpen(true);
      return;
    }

    if (action === "cancel") {
      setCancelRefundAmount(subscription.defaultRefundAmount.toFixed(2));
      setDialogMode("cancel");
      setOpen(true);
      return;
    }

    if (action === "stop") {
      setConfirmAction(action);
      return;
    }

    await executeDirectAction(action);
  }

  async function submitCancel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const refundAmount = String(formData.get("refund_amount") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();

    if (!refundAmount || Number(refundAmount) < 0) {
      toast.error(t("paymentAmountRequired"));
      return;
    }

    setPendingAction("cancel");

    const result = await cancelMembershipSubscription(subscription.subscriptionId, {
      refund_amount: refundAmount,
      method: paymentMethod,
      ...(reason ? { reason } : {}),
    });

    finishAction(result);
  }

  async function executeDirectAction(action: string) {
    setConfirmAction(null);

    setPendingAction(action);

    const result = await stopMembershipSubscription(subscription.subscriptionId);

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
          <DropdownMenuItem onClick={handleOpenWhatsApp}>{t("sendWhatsApp")}</DropdownMenuItem>
          {showRenewalReminderAction ? (
            <DropdownMenuItem onClick={handleOpenRenewalReminderWhatsApp}>{t("sendRenewalWhatsApp")}</DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {subscription.balance > 0 ? (
            <DropdownMenuItem
              data-disabled={pendingAction !== null ? "" : undefined}
              onClick={() => {
                if (pendingAction !== null) {
                  return;
                }

                setDialogMode("payment");
                setOpen(true);
              }}
            >
              {pendingAction === "payment" ? t("working") : t("addPayment")}
            </DropdownMenuItem>
          ) : null}
          {subscription.canCancelWithRefund ? (
            <DropdownMenuItem
              data-disabled={pendingAction !== null ? "" : undefined}
              onClick={() => {
                if (pendingAction !== null) {
                  return;
                }

                void runAction("cancel");
              }}
            >
              {pendingAction === "cancel" ? t("working") : t("cancelWithRefund")}
            </DropdownMenuItem>
          ) : null}
          {canOpenChangePlan ? (
            <DropdownMenuItem
              data-disabled={
                pendingAction !== null || (mainPlanOptions.length === 0 && extraPlanOptions.length === 0)
                  ? ""
                  : undefined
              }
              onClick={() => {
                if (pendingAction !== null || (mainPlanOptions.length === 0 && extraPlanOptions.length === 0)) {
                  return;
                }

                const initialTarget: ChangePlanTarget =
                  canChangeMainPlan && mainPlanOptions.length > 0
                    ? "main"
                    : canAddExtra && extraPlanOptions.length > 0
                      ? "extra"
                      : "main";
                switchChangePlanTarget(initialTarget);
                setDialogMode("change_plan");
                setOpen(true);
              }}
            >
              {pendingAction === "change_plan" ? t("working") : t("changePlan")}
            </DropdownMenuItem>
          ) : null}
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

          {dialogMode === "payment" ? (
            <form className="grid gap-3 rounded-lg border border-border/70 p-3" onSubmit={submitPayment}>
              <div>
                <div className="font-medium text-sm">{t("addPayment")}</div>
                <p className="text-muted-foreground text-xs">
                  {t("addPaymentDescription", {
                    balance: formatCurrency(subscription.balance, { currency: "EGP", noDecimals: true }),
                  })}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm" htmlFor={fieldId("payment-amount")}>
                  {t("paymentAmount")}
                  <Input
                    id={fieldId("payment-amount")}
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={subscription.balance || ""}
                  />
                </label>
                <div className="grid gap-1.5 text-sm">
                  {t("paymentMethod")}
                  <Select
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value as "cash" | "card" | "bank_transfer")}
                  >
                    <SelectTrigger id={fieldId("payment-method")} className="w-full">
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
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button type="submit" size="sm" disabled={pendingAction !== null}>
                  {pendingAction === "payment" ? t("working") : t("addPayment")}
                </Button>
              </div>
            </form>
          ) : null}

          {dialogMode === "cancel" ? (
            <form className="grid gap-3 rounded-lg border border-border/70 p-3" onSubmit={submitCancel}>
              <div>
                <div className="font-medium text-sm">{t("cancelWithRefund")}</div>
                <p className="text-muted-foreground text-xs">
                  {t("cancelWithRefundDescription", {
                    date: subscription.cancellationGraceEndsOn ?? "—",
                  })}
                </p>
              </div>
              <label className="grid gap-1.5 text-sm" htmlFor={fieldId("cancel-refund-amount")}>
                {t("refundAmount")}
                <Input
                  id={fieldId("cancel-refund-amount")}
                  name="refund_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cancelRefundAmount}
                  onChange={(event) => setCancelRefundAmount(event.currentTarget.value)}
                />
              </label>
              <div className="grid gap-1.5 text-sm">
                {t("paymentMethod")}
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as "cash" | "card" | "bank_transfer")}
                >
                  <SelectTrigger id={fieldId("cancel-method")} className="w-full">
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
              <label className="grid gap-1.5 text-sm" htmlFor={fieldId("cancel-reason")}>
                {t("reason")}
                <Textarea id={fieldId("cancel-reason")} name="reason" placeholder={t("optionalNote")} rows={2} />
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button type="submit" size="sm" variant="destructive" disabled={pendingAction !== null}>
                  {pendingAction === "cancel" ? t("working") : t("cancelWithRefund")}
                </Button>
              </div>
            </form>
          ) : null}

          {dialogMode === "change_plan" ? (
            <form className="grid gap-3 rounded-lg border border-border/70 p-3" onSubmit={submitChangePlan}>
              <div>
                <div className="font-medium text-sm">{t("changePlan")}</div>
                <p className="text-muted-foreground text-xs">
                  {changePlanTarget === "main" ? t("changeMainPlanDescription") : t("addExtraPlanDescription")}
                </p>
              </div>

              <div className="grid gap-2">
                <span className="font-medium text-muted-foreground text-xs">{t("planTarget")}</span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={changePlanTarget === "main" ? "default" : "outline"}
                    disabled={!canChangeMainPlan || mainPlanOptions.length === 0}
                    onClick={() => switchChangePlanTarget("main")}
                  >
                    {t("mainMembershipPlan")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={changePlanTarget === "extra" ? "default" : "outline"}
                    disabled={!canAddExtra || extraPlanOptions.length === 0}
                    onClick={() => switchChangePlanTarget("extra")}
                  >
                    {t("extraServicePlan")}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  {changePlanTarget === "main" ? t("mainMembershipPlanHelp") : t("extraServicePlanHelp")}
                </p>
              </div>

              {changePlanTarget === "main" ? (
                <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                  <span className="font-medium text-foreground">{t("currentMainPlan")}: </span>
                  <span className="text-muted-foreground">{subscription.plan ?? t("noPlan")}</span>
                </div>
              ) : subscription.addons.length > 0 ? (
                <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                  <div className="mb-1 font-medium text-foreground">{t("currentExtras")}</div>
                  <ul className="grid gap-0.5 text-muted-foreground">
                    {subscription.addons.map((addon) => (
                      <li key={addon.id}>
                        {addon.name}
                        {addon.coach ? ` · ${addon.coach}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-md border border-dashed px-3 py-2 text-muted-foreground text-xs">
                  {t("noExtrasYet")}
                </div>
              )}

              <label className="grid gap-1.5 text-sm" htmlFor={fieldId("change-plan")}>
                {changePlanTarget === "main" ? t("newMainPlan") : t("newExtraPlan")}
                <Select
                  value={selectedChangePlan ? String(selectedChangePlan.id) : ""}
                  onValueChange={(value) => {
                    setChangePlanId(value ?? "");
                    setChangePlanAmountOverride(null);
                  }}
                >
                  <SelectTrigger id={fieldId("change-plan")} className="w-full">
                    <SelectValue>{selectedChangePlanLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {availableChangePlans.map((plan) => (
                        <SelectItem
                          key={plan.id}
                          value={String(plan.id)}
                          disabled={
                            changePlanTarget === "main" &&
                            subscription.status === "active" &&
                            plan.id === subscription.planId
                          }
                        >
                          {formatPlanOptionLabel(plan, {
                            isCurrent:
                              changePlanTarget === "main" &&
                              subscription.status === "active" &&
                              plan.id === subscription.planId,
                            t,
                          })}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <input type="hidden" name="plan_id" value={selectedChangePlan ? String(selectedChangePlan.id) : ""} />
              </label>

              {changePlanTarget === "extra" ? (
                <label className="grid gap-1.5 text-sm" htmlFor={fieldId("change-plan-coach")}>
                  {t("coachOptional")}
                  <Select value={changePlanCoachId} onValueChange={(value) => setChangePlanCoachId(value ?? "")}>
                    <SelectTrigger id={fieldId("change-plan-coach")} className="w-full">
                      <SelectValue placeholder={t("selectCoach")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {subscription.coachOptions.map((coach) => (
                          <SelectItem key={coach.id} value={String(coach.id)}>
                            {coach.name} ({coach.role})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="coach_id" value={changePlanCoachId} />
                </label>
              ) : null}

              {changePlanTarget === "main" && changePlanMode === "upgrade" ? (
                <label className="grid gap-1.5 text-sm" htmlFor={fieldId("change-plan-credit-mode")}>
                  {t("creditMode")}
                  <Select
                    value={changePlanCreditMode}
                    onValueChange={(value) => {
                      setChangePlanCreditMode((value as "full_difference" | "day_proration") || "full_difference");
                      setChangePlanAmountOverride(null);
                    }}
                  >
                    <SelectTrigger id={fieldId("change-plan-credit-mode")} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="full_difference">{t("creditModeFullDifference")}</SelectItem>
                        <SelectItem value="day_proration">{t("creditModeDayProration")}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="credit_mode" value={changePlanCreditMode} />
                  <p className="text-muted-foreground text-xs">
                    {changePlanCreditMode === "full_difference"
                      ? t("creditModeFullDifferenceHint")
                      : t("creditModeDayProrationHint")}
                  </p>
                  {changePlanDetails ? (
                    <div
                      className={
                        changePlanDetails.isDowngrade
                          ? "mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
                          : "mt-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm"
                      }
                    >
                      <div
                        className={
                          changePlanDetails.isDowngrade
                            ? "flex items-center justify-between font-semibold text-amber-700 dark:text-amber-400"
                            : "flex items-center justify-between font-semibold text-blue-700 dark:text-blue-400"
                        }
                      >
                        <span>{changePlanDetails.isDowngrade ? t("downgradeRefund") : t("upgradeDifference")}</span>
                        <span className="text-base font-bold">
                          {changePlanDetails.isDowngrade
                            ? `-${changePlanDetails.refundAmount} EGP`
                            : `+${changePlanDetails.amountDue} EGP`}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span>{t("oldPlanCredit")}: </span>
                          <strong className="text-foreground">{changePlanDetails.credit} EGP</strong>
                        </div>
                        <div>
                          <span>{t("newPlanCost")}: </span>
                          <strong className="text-foreground">{changePlanDetails.newPrice} EGP</strong>
                        </div>
                        <div>
                          <span>{changePlanDetails.isDowngrade ? t("returnToMember") : t("paymentAmount")}: </span>
                          <strong className="text-foreground">
                            {changePlanDetails.isDowngrade
                              ? `${changePlanDetails.refundAmount} EGP`
                              : `${changePlanDetails.amountDue} EGP`}
                          </strong>
                        </div>
                      </div>
                      {subscription.paidTotal === 0 ? (
                        <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                          {t("unpaidCreditNote")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </label>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm" htmlFor={fieldId("change-plan-amount")}>
                  {t("paymentAmount")}
                  <Input
                    id={fieldId("change-plan-amount")}
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={changePlanPaymentAmount}
                    onChange={(event) => setChangePlanAmountOverride(event.currentTarget.value)}
                  />
                  {changePlanDetails?.isDowngrade ? (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      {t("downgradePaymentNotice", { refund: `${changePlanDetails.refundAmount}` })}
                    </p>
                  ) : null}
                </label>
                <label className="grid gap-1.5 text-sm" htmlFor={fieldId("change-plan-discount")}>
                  {t("discount")}
                  <Input
                    id={fieldId("change-plan-discount")}
                    name="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={changePlanDiscount}
                    onChange={(event) => {
                      setChangePlanDiscount(event.currentTarget.value);
                      setChangePlanAmountOverride(null);
                    }}
                  />
                </label>
              </div>
              <div className="grid gap-1.5 text-sm">
                {t("paymentMethod")}
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as "cash" | "card" | "bank_transfer")}
                >
                  <SelectTrigger id={fieldId("change-plan-method")} className="w-full">
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
                <Button type="submit" size="sm" disabled={pendingAction !== null || !selectedChangePlan}>
                  {pendingAction === "change_plan"
                    ? t("working")
                    : changePlanTarget === "main"
                      ? t("changeMainPlan")
                      : t("addExtraPlan")}
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
              <div className="rounded-md bg-muted/40 px-3 py-2 text-muted-foreground text-xs">
                {t("freezeAllowance", {
                  max: subscription.maxFreezeDays,
                  min: subscription.minFreezeDays,
                  selected: selectedFreezeDays ?? 0,
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <DatePickerField
                  id={fieldId("freeze-start")}
                  label={t("freezeStart")}
                  name="freeze_start"
                  value={freezeStartDate}
                  onChange={updateFreezeStartDate}
                  t={t}
                />
                <DatePickerField
                  id={fieldId("freeze-end")}
                  label={t("freezeEnd")}
                  name="freeze_end"
                  value={freezeEndDate}
                  onChange={setFreezeEndDate}
                  disabled={freezeEndRange ? { before: freezeEndRange.from, after: freezeEndRange.to } : undefined}
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
                <Button type="submit" size="sm" disabled={pendingAction !== null || isFreezeDurationInvalid}>
                  {pendingAction === "freeze" ? t("freezing") : t("freeze")}
                </Button>
              </div>
            </form>
          ) : null}

          {dialogMode === "unfreeze" ? (
            <form className="grid gap-3 rounded-lg border border-border/70 p-3" onSubmit={submitUnfreeze}>
              <div>
                <div className="font-medium text-sm">{t("unfreezeSubscription")}</div>
                <p className="text-muted-foreground text-xs">
                  {t("unfreezeDescription", {
                    count: subscription.freeze?.remainingDaysAtFreeze ?? subscription.daysLeft ?? 0,
                  })}
                </p>
              </div>
              <DatePickerField
                id={fieldId("resume-on")}
                label={t("resumeOn")}
                name="resume_on"
                value={resumeOnDate}
                onChange={setResumeOnDate}
                t={t}
              />
              <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-sm">
                <DetailRow label={t("frozenFrom")} value={subscription.freeze?.freezeStart ?? t("notAvailable")} />
                <DetailRow
                  label={t("remainingDaysProtected")}
                  value={t("daysValue", {
                    count: subscription.freeze?.remainingDaysAtFreeze ?? subscription.daysLeft ?? 0,
                  })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button type="submit" size="sm" disabled={pendingAction !== null}>
                  {pendingAction === "unfreeze" ? t("working") : t("unfreeze")}
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

function buildSubscriptionWhatsAppMessage(subscription: MembershipPipelineRow, t: CrmT, locale: string) {
  const lines: string[] = [];
  const memberName = subscription.member ?? t("unknownMember");
  const qrLabel = subscription.memberQr ? `${t("memberQr")}: ${subscription.memberQr}` : null;
  const qrImageUrl = buildQrImageUrl(subscription.memberQr, 320);

  if (locale === "ar") {
    if (subscription.health === "renewed") {
      lines.push(`مرحبًا ${memberName}`);
      lines.push(`تم تجديد اشتراكك بنجاح.`);
    } else if (subscription.daysLeft !== null && subscription.daysLeft <= 7) {
      lines.push(`مرحبًا ${memberName}`);
      lines.push(`نود تذكيرك أن اشتراكك أوشك على الانتهاء.`);
    } else {
      lines.push(`مرحبًا ${memberName}`);
      lines.push(`تم تفعيل اشتراكك بنجاح.`);
    }

    lines.push(
      `${t("memberId")}: ${subscription.memberId ? t("memberNumber", { id: subscription.memberId }) : t("notLinked")}`,
    );
    lines.push(`${t("plan")}: ${subscription.plan ?? t("noPlan")}`);
    lines.push(`${t("starts")}: ${subscription.startDate ?? t("noStartDate")}`);
    lines.push(`${t("ends")}: ${subscription.endDate ?? t("noEndDate")}`);
    lines.push(`${t("planPrice")}: ${formatCurrency(subscription.value, { currency: "EGP", noDecimals: true })}`);
  } else {
    if (subscription.health === "renewed") {
      lines.push(`Hello ${memberName}, your membership has been renewed successfully.`);
    } else if (subscription.daysLeft !== null && subscription.daysLeft <= 7) {
      lines.push(`Hello ${memberName}, your membership is about to end soon.`);
    } else {
      lines.push(`Hello ${memberName}, your membership is now active.`);
    }

    lines.push(
      `${t("memberId")}: ${subscription.memberId ? t("memberNumber", { id: subscription.memberId }) : t("notLinked")}`,
    );
    lines.push(`${t("plan")}: ${subscription.plan ?? t("noPlan")}`);
    lines.push(`${t("starts")}: ${subscription.startDate ?? t("noStartDate")}`);
    lines.push(`${t("ends")}: ${subscription.endDate ?? t("noEndDate")}`);
    lines.push(`${t("planPrice")}: ${formatCurrency(subscription.value, { currency: "EGP", noDecimals: true })}`);
  }

  if (subscription.addons.length > 0) {
    lines.push("");
    lines.push(t("whatsAppAddons"));

    for (const addon of subscription.addons) {
      const coach = addon.coach ? ` - ${t("whatsAppCoach")}: ${addon.coach}` : "";
      lines.push(`- ${addon.name}${coach}`);
    }
  }

  if (qrLabel) {
    lines.push("");
    lines.push(qrLabel);

    if (qrImageUrl) {
      lines.push(`${t("memberQrImage")}: ${qrImageUrl}`);
    }
  }

  return lines.join("\n");
}

function buildSubscriptionReminderWhatsAppMessage(
  subscription: MembershipPipelineRow,
  t: CrmT,
  locale: string,
  reminderDays: number[],
) {
  const lines: string[] = [];
  const memberName = subscription.member ?? t("unknownMember");
  const qrImageUrl = buildQrImageUrl(subscription.memberQr, 320);

  const nearestReminderDay =
    subscription.daysLeft !== null && reminderDays.includes(subscription.daysLeft)
      ? subscription.daysLeft
      : (reminderDays[0] ?? 7);

  if (locale === "ar") {
    lines.push(`مرحبًا ${memberName}`);
    lines.push(
      subscription.daysLeft === 0
        ? "تذكير: اشتراكك ينتهي اليوم."
        : `تذكير: اشتراكك سينتهي خلال ${nearestReminderDay} يوم.`,
    );
    lines.push(`الخطة: ${subscription.plan ?? t("noPlan")}`);
    lines.push(`تاريخ الانتهاء: ${subscription.endDate ?? t("noEndDate")}`);
    lines.push(`برجاء التواصل معنا لتجديد الاشتراك قبل انتهاء المدة.`);
  } else {
    lines.push(`Hello ${memberName},`);
    lines.push(
      subscription.daysLeft === 0
        ? "reminder: your membership ends today."
        : `reminder: your membership will end in ${nearestReminderDay} day(s).`,
    );
    lines.push(`Plan: ${subscription.plan ?? t("noPlan")}`);
    lines.push(`End date: ${subscription.endDate ?? t("noEndDate")}`);
    lines.push("Please contact us to renew your membership before it expires.");
  }

  if (subscription.memberQr) {
    lines.push(`${t("memberQr")}: ${subscription.memberQr}`);
    if (qrImageUrl) {
      lines.push(`${t("memberQrImage")}: ${qrImageUrl}`);
    }
  }

  return lines.join("\n");
}

function DatePickerField({
  id,
  label,
  name,
  value,
  onChange,
  disabled,
  t,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: React.ComponentProps<typeof Calendar>["disabled"];
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
            disabled={disabled}
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
    case "cancel":
      return t("cancelWithRefund");
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

function getConfirmActionLabel(action: "stop" | null, pendingAction: string | null, t: CrmT) {
  if (pendingAction === action) {
    return t("working");
  }

  if (action) {
    return labelAction(action, t);
  }

  return t("confirm");
}

function getDialogDescription(mode: DialogMode, t: CrmT) {
  switch (mode) {
    case "renew":
      return t("renewDialogDescription");
    case "payment":
      return t("addPaymentDialogDescription");
    case "change_plan":
      return t("changePlanDialogDescription");
    case "cancel":
      return t("cancelWithRefundDialogDescription");
    case "freeze":
      return t("freezeDialogDescription");
    case "unfreeze":
      return t("unfreezeDialogDescription");
    default:
      return t("detailsDescription");
  }
}

function calculatePlanChangeDetails({
  creditMode,
  newPrice,
  paidTotal,
  startDate,
  endDate,
  extraDiscount,
}: {
  creditMode: "full_difference" | "day_proration";
  newPrice: number;
  paidTotal: number;
  startDate: string | null;
  endDate: string | null;
  extraDiscount: string;
}) {
  const price = Number.isFinite(newPrice) ? Math.max(0, newPrice) : 0;
  const paid = Number.isFinite(paidTotal) ? Math.max(0, paidTotal) : 0;
  const extra = Number(extraDiscount || 0);
  const extraSafe = Number.isFinite(extra) ? Math.max(0, extra) : 0;

  let credit = paid;

  if (creditMode === "day_proration" && startDate && endDate) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
    const usedDays = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
    const remainingDays = Math.max(0, totalDays - usedDays);
    credit = remainingDays > 0 ? (paid / totalDays) * remainingDays : 0;
  }

  const effectiveCredit = credit + extraSafe;
  const amountDue = Math.max(0, price - effectiveCredit);
  const refundAmount = Math.max(0, effectiveCredit - price);

  return {
    credit: credit.toFixed(2),
    newPrice: price.toFixed(2),
    amountDue: amountDue.toFixed(2),
    refundAmount: refundAmount.toFixed(2),
    isDowngrade: effectiveCredit > price,
    isUpgrade: price > effectiveCredit,
    isEqual: price === effectiveCredit,
  };
}

function calculateUpgradePaymentAmount({
  creditMode,
  newPrice,
  paidTotal,
  startDate,
  endDate,
  extraDiscount,
}: {
  creditMode: "full_difference" | "day_proration";
  newPrice: number;
  paidTotal: number;
  startDate: string | null;
  endDate: string | null;
  extraDiscount: string;
}) {
  return calculatePlanChangeDetails({
    creditMode,
    newPrice,
    paidTotal,
    startDate,
    endDate,
    extraDiscount,
  }).amountDue;
}

function formatPlanOptionLabel(
  plan: MembershipPipelineRow["planOptions"][number],
  options?: { isCurrent?: boolean; t: CrmT },
) {
  const label = `${plan.name} - ${formatCurrency(plan.price, { currency: "EGP", noDecimals: true })}`;

  return options?.isCurrent ? `${label} (${options.t("currentPlan")})` : label;
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

function getFreezeEndRange(start: string, minDays: number, maxDays: number) {
  const startDate = parseDateString(start);

  if (!startDate || maxDays < 1) {
    return null;
  }

  const normalizedMinDays = Math.max(1, minDays);

  return {
    from: addDays(startDate, normalizedMinDays - 1),
    to: addDays(startDate, maxDays - 1),
  };
}

function clampDateString(value: string, min: Date, max: Date) {
  const date = parseDateString(value);

  if (!date || date < min) {
    return formatDateString(min);
  }

  if (date > max) {
    return formatDateString(max);
  }

  return value;
}

function getInclusiveDays(start: string, end: string) {
  const startDate = parseDateString(start);
  const endDate = parseDateString(end);

  if (!startDate || !endDate) {
    return null;
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
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
  if (
    value === "paid" ||
    value === "pending" ||
    value === "overdue" ||
    value === "refunded" ||
    value === "partial_refund" ||
    value === "stopped"
  ) {
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

  if (subscription.healthReason === "refunded") {
    return t("healthReasons.refunded");
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
    return t("noRemainingDays");
  }

  if (daysLeft < 0) {
    return t("expiredDaysAgo", { count: Math.abs(daysLeft) });
  }

  return t("daysValue", { count: daysLeft });
}
