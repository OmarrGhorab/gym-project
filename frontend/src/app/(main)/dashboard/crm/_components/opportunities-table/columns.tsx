"use client";
"use no memo";

import * as React from "react";

import { useRouter } from "next/navigation";

import type { ColumnDef } from "@tanstack/react-table";
import { addDays, addMonths, format, parseISO } from "date-fns";
import { CalendarIcon, EllipsisVertical } from "lucide-react";
import type { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { toast } from "sonner";

import type { MemberRow, StaffOption } from "@/app/(main)/dashboard/members/_components/data";
import { MemberChangePlanDialog } from "@/app/(main)/dashboard/members/_components/member-action-dialogs";
import type { PlanRow } from "@/app/(main)/dashboard/plans/_components/data";
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
import { WhatsAppNotificationButton } from "@/components/whatsapp-notification-button";
import { cn, formatCurrency } from "@/lib/utils";
import { buildQrImageUrl, buildWhatsAppUrl } from "@/lib/whatsapp";

import {
  cancelMembershipAddon,
  cancelMembershipSubscription,
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

type PaymentMethod = (typeof paymentMethodItems)[number]["value"];

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
    // Paid for, but not running yet — distinct from active so staff do not read
    // it as access the member already has.
    case "scheduled":
      return "border-blue-500/35 bg-blue-500/10 text-blue-700 dark:text-blue-300";
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
  canApproveFreeze: boolean,
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
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm">{row.original.member ?? t("notLinked")}</span>
            {row.original.memberPhone ? (
              <WhatsAppNotificationButton
                phone={row.original.memberPhone}
                data={{
                  member_name: row.original.member,
                  plan_name: row.original.plan,
                  start_date: row.original.startDate,
                  end_date: row.original.endDate,
                  amount_paid: row.original.paidTotal,
                  attendance_qr: row.original.memberQr,
                  sessions_remaining: row.original.sessionsRemaining,
                }}
                size="sm"
                className="h-6 px-1.5 text-[11px]"
              />
            ) : null}
          </div>
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
      cell: ({ row }) => {
        const addons = row.original.addons ?? [];

        return (
          <div className="grid gap-1">
            <div className="font-medium text-sm">{row.original.plan ?? t("noPlan")}</div>
            <span className="text-muted-foreground text-xs">
              Paid: {formatCurrency(row.original.mainPlanPaidTotal, { currency: "EGP" })}
            </span>
            {addons.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {addons.map((addon) => (
                  <Badge key={addon.id} variant="outline" className="px-1.5 py-0 font-normal text-[11px]">
                    + {addon.name} · {formatCurrency(addon.paidTotal, { currency: "EGP" })}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        );
      },
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
                : // Counting down to the end date reads as access the member does
                  // not have yet; until it starts, the wait is the useful number.
                  (formatDaysUntilStart(row.original.startsInDays, t) ?? formatDaysLeft(row.original.daysLeft, t))}
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
          <SubscriptionActions
            subscription={row.original}
            t={t}
            reminderDays={reminderDays}
            canApproveFreeze={canApproveFreeze}
          />
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
  canApproveFreeze,
}: {
  subscription: MembershipPipelineRow;
  t: CrmT;
  reminderDays: number[];
  canApproveFreeze: boolean;
}) {
  const router = useRouter();
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const [changePlanDialogOpen, setChangePlanDialogOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<"stop" | null>(null);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("details");
  const [paymentMethod, setPaymentMethod] = React.useState<"cash" | "card" | "bank_transfer">("cash");
  const [freezeStartDate, setFreezeStartDate] = React.useState(() => getTodayDateString());
  const [freezeEndDate, setFreezeEndDate] = React.useState(() => getTodayDateString());
  const [resumeOnDate, setResumeOnDate] = React.useState(() => getTodayDateString());
  const [cancelAddonId, setCancelAddonId] = React.useState<number | null>(null);
  const [cancelRefundScope, setCancelRefundScope] = React.useState<"full_package" | "main_plan">("full_package");
  const [renewDiscount, setRenewDiscount] = React.useState("0");
  const [renewAmount, setRenewAmount] = React.useState(() => formatMoneyInput(subscription.planPrice));
  const [renewAddons, setRenewAddons] = React.useState<Record<number, { selected: boolean; coachId: string }>>({});

  const dialogPlans: PlanRow[] = React.useMemo(
    () =>
      subscription.planOptions.map((p) => ({
        id: p.id,
        name: p.name,
        description: null,
        price: String(p.price),
        duration_days: p.durationDays,
        duration_months: p.durationMonths,
        sessions_count: p.sessionsCount ?? null,
        is_unlimited_sessions: p.isUnlimitedSessions ?? true,
        // `type` decides whether the dialog treats this as a studio plan and asks
        // for a coach; substituting category here made every studio plan look like
        // a plain one, so the coach picker never appeared.
        type: p.type,
        category: p.category,
        // Without the assignment rules the dialog falls back to listing every
        // coach in the gym instead of the ones actually assigned to this plan.
        employee_commission_rules: p.coaches.map((coach) => ({
          id: coach.id,
          employee_id: coach.id,
          plan_id: p.id,
          calculation_type: "percentage" as const,
          value: "0",
          is_active: true,
          employee: { id: coach.id, name: coach.name, role: coach.role },
        })),
        is_active: true,
        is_sellable: true,
        valid_from: null,
        valid_to: null,
        access_starts_at: null,
        access_ends_at: null,
        max_freeze_days: 0,
        access_grace_days: 0,
        cancellation_grace_days: 2,
        min_freeze_days: 0,
        freeze_requires_approval: false,
        created_at: null,
        status: "active",
      })),
    [subscription.planOptions],
  );

  const dialogStaff: StaffOption[] = React.useMemo(
    () =>
      subscription.coachOptions.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
      })),
    [subscription.coachOptions],
  );

  const memberRow: MemberRow = React.useMemo(() => {
    const addonsTotal = subscription.addons.reduce((sum, item) => sum + item.price, 0);
    const mainPlanPrice = Math.max(0, subscription.value - addonsTotal);
    const mainPlanPaidTotal = Math.max(0, subscription.paidTotal - addonsTotal);

    return {
      id: subscription.memberId ?? 0,
      name: subscription.member ?? "Member",
      phone: subscription.memberPhone ?? "",
      email: null,
      national_id: null,
      gender: null,
      attendance_code: null,
      attendance_qr: subscription.memberQr ?? null,
      birth_date: null,
      join_date: subscription.startDate ?? null,
      expiry_date: subscription.endDate ?? null,
      status: subscription.status,
      notes: null,
      has_photo: false,
      total_paid: String(subscription.paidTotal),
      latest_subscription: {
        id: subscription.subscriptionId,
        plan_id: subscription.planId,
        plan_name: subscription.plan,
        plan:
          subscription.planId && subscription.plan
            ? { id: subscription.planId, name: subscription.plan, price: mainPlanPrice }
            : null,
        start_date: subscription.startDate,
        end_date: subscription.endDate,
        status: subscription.status,
        price_paid: String(mainPlanPrice),
        paid_total: String(mainPlanPaidTotal),
        balance: String(subscription.balance),
        package_price_paid: String(subscription.value),
        package_paid_total: String(subscription.paidTotal),
        package_balance: String(subscription.balance),
        sessions_total: subscription.sessionsTotal,
        sessions_remaining: subscription.sessionsRemaining,
        can_cancel_with_refund: subscription.canCancelWithRefund,
        cancellation_grace_ends_on: subscription.cancellationGraceEndsOn,
        default_refund_amount: String(subscription.paidTotal),
        addons: subscription.addons.map((a) => ({
          id: a.id,
          status: "active",
          end_date: a.endDate,
          price_paid: String(a.price),
          sessions_total: a.sessionsTotal,
          sessions_remaining: a.sessionsRemaining,
          coach: a.coach ? { name: a.coach } : null,
          plan: { name: a.name, price: a.price },
        })),
      },
    };
  }, [subscription]);
  const [cancelRefundAmount, setCancelRefundAmount] = React.useState(() => subscription.defaultRefundAmount.toFixed(2));
  const renewDiscountValue = Math.max(0, Number(renewDiscount) || 0);
  const renewAmountValue = Math.max(0, Number(renewAmount) || 0);
  const renewTotalDue = Math.max(0, subscription.planPrice - renewDiscountValue);
  const renewRemainingBalance = Math.max(0, renewTotalDue - renewAmountValue);
  const renewOverpayment = Math.max(0, renewAmountValue - renewTotalDue);
  const renewPeriod = getRenewPeriod(subscription);
  // Extras that ended or were refunded have to be re-bought; ones still running are
  // moved onto the new period by the backend, so offering them again would duplicate.
  const { renewable: renewableAddons, carried: carriedAddons } = splitAddonsForRenewal(subscription, renewPeriod.start);
  const selectedRenewAddons = renewableAddons.filter((addon) => renewAddons[addon.id]?.selected);
  const renewAddonsTotal = selectedRenewAddons.reduce((sum, addon) => sum + addon.planPrice, 0);
  const renewPackageTotal = renewTotalDue + renewAddonsTotal;
  const isRenewInvalid =
    renewDiscountValue > subscription.planPrice ||
    !subscription.planIsSellable ||
    selectedRenewAddons.some((addon) => !addon.planId || !renewAddons[addon.id]?.coachId);
  const selectedFreezeDays = getInclusiveDays(freezeStartDate, freezeEndDate);
  const freezeEndRange = getFreezeEndRange(freezeStartDate, subscription.minFreezeDays, subscription.maxFreezeDays);
  const isFreezeDurationInvalid =
    selectedFreezeDays === null ||
    (subscription.minFreezeDays > 0 && selectedFreezeDays < subscription.minFreezeDays) ||
    selectedFreezeDays > subscription.maxFreezeDays;
  // An approval-only plan is not blocked outright — it is blocked for staff who
  // cannot sign it off, which is what the backend enforces.
  const freezeDisabledReason =
    subscription.maxFreezeDays < 1
      ? t("freezeUnavailableReason")
      : subscription.freezeRequiresApproval && !canApproveFreeze
        ? t("freezeApprovalMissing")
        : null;
  const backendActions = getBackendActions(subscription.status);
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

  /** Discount reprices the renewal, so the amount collected follows it unless staff override it after. */
  function updateRenewDiscount(value: string) {
    setRenewDiscount(value);

    const nextDiscount = Math.max(0, Number(value) || 0);

    setRenewAmount(formatMoneyInput(Math.max(0, subscription.planPrice - nextDiscount)));
  }

  async function submitRenew(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (renewAmount.trim() === "" || renewAmountValue < 0) {
      toast.error(t("paymentAmountRequired"));
      return;
    }

    if (renewDiscountValue > subscription.planPrice) {
      toast.error(t("renewDiscountTooLarge", { price: formatCurrency(subscription.planPrice, { currency: "EGP" }) }));
      return;
    }

    const addonPayload = selectedRenewAddons.flatMap((addon) => {
      const coachId = Number(renewAddons[addon.id]?.coachId);

      if (!addon.planId || !Number.isFinite(coachId) || coachId <= 0) {
        return [];
      }

      return [
        {
          plan_id: addon.planId,
          coach_id: coachId,
          discount: "0.00",
          payment: { amount: addon.planPrice.toFixed(2), method: paymentMethod },
        },
      ];
    });

    if (addonPayload.length !== selectedRenewAddons.length) {
      toast.error(t("renewExtraCoachRequired"));
      return;
    }

    setPendingAction("renew");

    const result = await renewMembershipSubscription(subscription.subscriptionId, {
      discount: renewDiscountValue.toFixed(2),
      payment: {
        amount: renewAmountValue.toFixed(2),
        method: paymentMethod,
      },
      ...(addonPayload.length > 0 ? { addons: addonPayload } : {}),
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

      if (action === "renew") {
        // Reprice from the plan every time the dialog opens — a stale amount from a
        // previous attempt would silently under- or over-charge the new period.
        setRenewDiscount("0");
        setRenewAmount(formatMoneyInput(subscription.planPrice));
        setRenewAddons(
          Object.fromEntries(
            subscription.addons.map((addon) => {
              const options = getAddonCoachOptions(subscription, addon.planId);
              // Keep the previous coach only while they still service this plan;
              // otherwise fall back to the first eligible one.
              const previousStillEligible = options.some((coach) => coach.id === addon.coachId);
              const defaultCoach = previousStillEligible ? addon.coachId : (options[0]?.id ?? null);

              return [addon.id, { selected: false, coachId: defaultCoach ? String(defaultCoach) : "" }];
            }),
          ),
        );
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
      setCancelRefundScope("full_package");
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

    const cancel = cancelAddonId
      ? cancelMembershipAddon(subscription.subscriptionId, cancelAddonId, {
          refund_amount: refundAmount,
          refund_scope: cancelRefundScope,
          method: paymentMethod,
          ...(reason ? { reason } : {}),
        })
      : cancelMembershipSubscription(subscription.subscriptionId, {
          refund_amount: refundAmount,
          method: paymentMethod,
          ...(reason ? { reason } : {}),
        });

    const result = await cancel;

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
          {subscription.status === "active" || subscription.status === "frozen" ? (
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
          {subscription.memberId ? (
            <DropdownMenuItem onClick={() => setChangePlanDialogOpen(true)}>{t("changePlan")}</DropdownMenuItem>
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
              <DetailRow
                label={`${t("plan")} ${t("paid")}`}
                value={formatCurrency(subscription.mainPlanPaidTotal, { currency: "EGP", noDecimals: true })}
              />
              {subscription.addons.map((addon) => (
                <DetailRow
                  key={addon.id}
                  label={`+ ${addon.name} ${t("paid")}`}
                  value={formatCurrency(addon.paidTotal, { currency: "EGP", noDecimals: true })}
                />
              ))}
              <DetailRow label={t("status")} value={translateStatus(subscription.status, t)} />
              <DetailRow label={t("payment")} value={translateBillingStatus(subscription.billingStatus, t)} />
              <DetailRow
                label={t("renewalHealth")}
                value={`${translateHealth(subscription.health, t)} - ${translateHealthReason(subscription, t)}`}
              />
              <DetailRow label={t("starts")} value={subscription.startDate ?? t("noStartDate")} />
              <DetailRow label={t("ends")} value={subscription.endDate ?? t("noEndDate")} />
              <DetailRow
                label={t("daysLeft")}
                value={formatDaysUntilStart(subscription.startsInDays, t) ?? formatDaysLeft(subscription.daysLeft, t)}
              />
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

              <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs">
                <div className="font-semibold text-foreground text-xs uppercase tracking-wider">
                  {t("renewSummary")}
                </div>
                <SummaryRow label={t("member")} value={subscription.member ?? t("notLinked")} />
                <SummaryRow label={t("plan")} value={subscription.plan ?? t("noPlan")} />
                <SummaryRow
                  label={t("renewNewPeriod")}
                  value={formatSubscriptionPeriod(renewPeriod.start, renewPeriod.end, t)}
                />
                <SummaryRow
                  label={t("planPrice")}
                  value={formatCurrency(subscription.planPrice, { currency: "EGP" })}
                />
                <SummaryRow
                  label={t("discount")}
                  value={`- ${formatCurrency(renewDiscountValue, { currency: "EGP" })}`}
                />
                {selectedRenewAddons.map((addon) => (
                  <SummaryRow
                    key={`summary-${addon.id}`}
                    label={`+ ${addon.name}`}
                    value={formatCurrency(addon.planPrice, { currency: "EGP" })}
                  />
                ))}
                {carriedAddons.map((addon) => (
                  <SummaryRow
                    key={`carried-${addon.id}`}
                    label={`+ ${addon.name}`}
                    value={t("renewExtraCarriedOver")}
                  />
                ))}
                <div className="flex justify-between border-t pt-1.5 font-semibold text-foreground">
                  <span>{t("renewTotalDue")}</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(renewPackageTotal, { currency: "EGP" })}
                  </span>
                </div>
                <SummaryRow
                  label={t("renewPayingNow")}
                  value={formatCurrency(renewAmountValue + renewAddonsTotal, { currency: "EGP" })}
                />
                {renewRemainingBalance > 0 ? (
                  <SummaryRow
                    label={t("renewRemainingBalance")}
                    value={formatCurrency(renewRemainingBalance, { currency: "EGP" })}
                  />
                ) : null}
                {renewOverpayment > 0 ? (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    {t("renewExtraCredit", { amount: formatCurrency(renewOverpayment, { currency: "EGP" }) })}
                  </p>
                ) : null}
                {renewDiscountValue > subscription.planPrice ? (
                  <p className="text-[11px] text-red-700 dark:text-red-300">
                    {t("renewDiscountTooLarge", {
                      price: formatCurrency(subscription.planPrice, { currency: "EGP" }),
                    })}
                  </p>
                ) : null}
                {subscription.planIsSellable ? null : (
                  <p className="text-[11px] text-red-700 dark:text-red-300">{t("renewPlanUnavailable")}</p>
                )}
              </div>

              {renewableAddons.length > 0 ? (
                <div className="grid gap-2 rounded-md border p-3">
                  <div>
                    <div className="font-medium text-sm">{t("renewExtrasTitle")}</div>
                    <p className="text-muted-foreground text-xs">{t("renewExtrasDescription")}</p>
                  </div>
                  {renewableAddons.map((addon) => {
                    const entry = renewAddons[addon.id] ?? { selected: false, coachId: "" };
                    // Only coaches with an active commission rule on this service can be
                    // sold it — anyone else is rejected by the API on submit.
                    const addonCoaches = getAddonCoachOptions(subscription, addon.planId);
                    const hasCoach = addonCoaches.length > 0;

                    return (
                      <div key={addon.id} className="grid gap-2 rounded-md bg-muted/30 p-2.5">
                        <label className="flex items-start gap-2 text-sm" htmlFor={fieldId(`renew-extra-${addon.id}`)}>
                          <Checkbox
                            id={fieldId(`renew-extra-${addon.id}`)}
                            checked={entry.selected}
                            disabled={!addon.planId || !hasCoach}
                            onCheckedChange={(checked) =>
                              setRenewAddons((current) => ({
                                ...current,
                                [addon.id]: { ...entry, selected: Boolean(checked) },
                              }))
                            }
                          />
                          <span className="grid gap-0.5">
                            <span className="font-medium">{addon.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {formatCurrency(addon.planPrice, { currency: "EGP" })}
                              {addon.sessionsTotal ? ` · ${t("daysValue", { count: addon.sessionsTotal })}` : ""}
                            </span>
                            {hasCoach ? null : (
                              <span className="text-[11px] text-red-700 dark:text-red-300">
                                {t("renewExtraNoCoachAssigned")}
                              </span>
                            )}
                          </span>
                        </label>
                        {entry.selected && hasCoach ? (
                          <div className="grid gap-1.5 text-xs">
                            {t("selectCoach")}
                            <Select
                              value={entry.coachId}
                              onValueChange={(value) =>
                                setRenewAddons((current) => ({
                                  ...current,
                                  [addon.id]: { ...entry, coachId: value ?? "" },
                                }))
                              }
                            >
                              <SelectTrigger id={fieldId(`renew-extra-coach-${addon.id}`)} className="w-full">
                                {/* Base UI renders the raw value unless it is told how to label it. */}
                                <SelectValue placeholder={t("selectCoach")}>
                                  {(value) =>
                                    addonCoaches.find((coach) => String(coach.id) === String(value))?.name ??
                                    t("selectCoach")
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {addonCoaches.map((coach) => (
                                    <SelectItem key={coach.id} value={String(coach.id)}>
                                      {coach.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm" htmlFor={fieldId("renew-amount")}>
                  {t("renewMainPlanPayment")}
                  <Input
                    id={fieldId("renew-amount")}
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={renewAmount}
                    onChange={(event) => setRenewAmount(event.currentTarget.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-sm" htmlFor={fieldId("renew-discount")}>
                  {t("discount")}
                  <Input
                    id={fieldId("renew-discount")}
                    name="discount"
                    type="number"
                    min="0"
                    max={subscription.planPrice}
                    step="0.01"
                    value={renewDiscount}
                    onChange={(event) => updateRenewDiscount(event.currentTarget.value)}
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
                    <SelectValue placeholder={t("selectPaymentMethod")}>
                      {(value) => (value ? t(`paymentMethods.${value as PaymentMethod}`) : t("selectPaymentMethod"))}
                    </SelectValue>
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
                <Button type="submit" size="sm" disabled={pendingAction !== null || isRenewInvalid}>
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
                      <SelectValue placeholder={t("selectPaymentMethod")}>
                        {(value) => (value ? t(`paymentMethods.${value as PaymentMethod}`) : t("selectPaymentMethod"))}
                      </SelectValue>
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

              {(() => {
                const addonsTotal = subscription.addons.reduce((sum, a) => sum + (a.price || 0), 0);
                const mainPlanPrice = Math.max(0, subscription.value - addonsTotal);

                return (
                  <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs">
                    <div className="font-semibold text-foreground text-xs uppercase tracking-wider">
                      Subscription & Sessions Summary
                    </div>

                    <div className="flex justify-between border-b pt-1 pb-1.5">
                      <span className="text-muted-foreground">Main Plan ({subscription.plan ?? t("noPlan")}):</span>
                      <span className="font-medium font-mono tabular-nums">
                        {formatCurrency(mainPlanPrice, { currency: "EGP" })}
                      </span>
                    </div>

                    {subscription.addons.map((addon) => (
                      <div key={addon.id} className="grid gap-0.5 border-b pb-1.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">+ Extra: {addon.name}</span>
                          <span className="font-medium font-mono tabular-nums">
                            {formatCurrency(addon.price, { currency: "EGP" })}
                          </span>
                        </div>
                        <div className="flex justify-between pl-2 text-[11px] text-muted-foreground">
                          <span>Coach: {addon.coach ?? "Unassigned"}</span>
                          <span className="font-medium text-foreground">
                            {addon.sessionsRemaining !== null && addon.sessionsRemaining !== undefined
                              ? `${
                                  addon.sessionsTotal ? addon.sessionsTotal - addon.sessionsRemaining : 0
                                } attended (${addon.sessionsRemaining}/${addon.sessionsTotal ?? "—"} remaining)`
                              : "Unlimited"}
                          </span>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-between pt-1 font-semibold text-foreground">
                      <span>Total Package Paid:</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(subscription.paidTotal, { currency: "EGP" })}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="w-full font-medium text-[11px] text-muted-foreground">Quick Select Refund:</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setCancelAddonId(null);
                          setCancelRefundScope("full_package");
                          setCancelRefundAmount(subscription.paidTotal.toFixed(2));
                        }}
                      >
                        Full Package ({formatCurrency(subscription.paidTotal, { currency: "EGP", noDecimals: true })})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setCancelAddonId(null);
                          setCancelRefundScope("main_plan");
                          setCancelRefundAmount(mainPlanPrice.toFixed(2));
                        }}
                      >
                        Main Plan Only ({formatCurrency(mainPlanPrice, { currency: "EGP", noDecimals: true })})
                      </Button>
                      {subscription.addons.map((addon) => (
                        <Button
                          key={addon.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setCancelAddonId(addon.id);
                            setCancelRefundScope("full_package");
                            setCancelRefundAmount(addon.paidTotal.toFixed(2));
                          }}
                        >
                          Refund {addon.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })()}

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
                    <SelectValue placeholder={t("selectPaymentMethod")}>
                      {(value) => (value ? t(`paymentMethods.${value as PaymentMethod}`) : t("selectPaymentMethod"))}
                    </SelectValue>
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
              {subscription.freezeRequiresApproval ? (
                <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-amber-700 text-xs dark:text-amber-300">
                  {t("freezeNeedsApproval")}{" "}
                  {canApproveFreeze ? t("freezeApprovalGranted") : t("freezeApprovalMissing")}
                </div>
              ) : null}
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

      {subscription.memberId ? (
        <MemberChangePlanDialog
          member={memberRow}
          open={changePlanDialogOpen}
          onOpenChange={setChangePlanDialogOpen}
          plans={dialogPlans}
          staff={dialogStaff}
        />
      ) : null}
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium font-mono tabular-nums">{value}</span>
    </div>
  );
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

function formatMoneyInput(value: number) {
  return Number.isFinite(value) && value > 0 ? String(Number(value.toFixed(2))) : "0";
}

/**
 * Mirrors RenewSubscription + Plan::endDateFrom so staff see the period they are
 * buying before they commit: closed periods restart today, live ones stack.
 */
function getRenewPeriod(subscription: MembershipPipelineRow) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentEnd = parseDateString(subscription.endDate ?? "");
  const isClosed = subscription.status === "stopped" || subscription.status === "expired";
  const start = !isClosed && currentEnd && currentEnd >= today ? addDays(currentEnd, 1) : today;

  const months = subscription.planDurationMonths ?? 0;
  const end = months > 0 ? addMonths(start, months) : addDays(start, Math.max(0, subscription.planDurationDays ?? 0));

  return { start: formatDateString(start), end: formatDateString(end) };
}

/**
 * Coaches the API will accept for an extra service: those holding an active
 * commission rule on that plan (CreateSubscription::coachCanSellAddon). Anyone
 * else fails validation, so they must never reach the dropdown.
 */
function getAddonCoachOptions(subscription: MembershipPipelineRow, planId: number | null) {
  if (planId === null) {
    return [];
  }

  return subscription.planOptions.find((plan) => plan.id === planId)?.coaches ?? [];
}

/**
 * Mirrors CreateSubscription::carryForwardActiveAddons — an extra that is still
 * active on the renewal start date follows the member to the new period for free,
 * so only the closed ones are offered for re-purchase.
 */
function splitAddonsForRenewal(subscription: MembershipPipelineRow, renewStart: string) {
  const renewable: MembershipPipelineRow["addons"] = [];
  const carried: MembershipPipelineRow["addons"] = [];

  for (const addon of subscription.addons) {
    const stillRunning = addon.status === "active" && (addon.endDate === null || addon.endDate >= renewStart);

    if (stillRunning) {
      carried.push(addon);
    } else {
      renewable.push(addon);
    }
  }

  return { renewable, carried };
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
  if (
    value === "active" ||
    value === "scheduled" ||
    value === "frozen" ||
    value === "expired" ||
    value === "stopped" ||
    value === "pending"
  ) {
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
    // An advance sale is still a live membership on the API side, so keep the
    // same actions — staff must be able to stop one the member no longer wants.
    case "scheduled":
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

/** Null unless the membership is still waiting for its start date. */
function formatDaysUntilStart(startsInDays: number | null, t: CrmT) {
  if (startsInDays === null || startsInDays <= 0) {
    return null;
  }

  return t("startsInDays", { count: startsInDays });
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
