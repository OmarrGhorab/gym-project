"use client";

import * as React from "react";
import { useActionState } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  Ban,
  Camera,
  CircleStop,
  CreditCard,
  Eye,
  ImageUp,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Play,
  PlusCircle,
  Receipt,
  RefreshCw,
  Snowflake,
  SquarePen,
  UserPlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/ui/field";
import { FormDatePicker, FormSelect } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQueryDialog } from "@/hooks/use-query-dialog";
import { canAccess } from "@/lib/authorization";
import { getGymTodayString } from "@/lib/timezone";
import { cn, formatCurrency } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

import {
  correctMembershipSubscription,
  freezeMembershipSubscription,
  recordMembershipPayment,
  renewMembershipSubscription,
  stopMembershipSubscription,
  unfreezeMembershipSubscription,
} from "../../crm/_components/actions";
import type { PlanRow } from "../../plans/_components/data";
import {
  cancelMemberSubscription,
  changeMemberPlan,
  createMember,
  createMemberReportShareLink,
  createMemberSubscription,
  deactivateMember,
  fetchMemberDetails,
  reactivateMember,
  updateMember,
  uploadMemberPhoto,
} from "./actions";
import type {
  MemberDueRow,
  MemberPaymentHistory,
  MemberPaymentRow,
  MemberReportData,
  MemberRow,
  MemberVisitRow,
  StaffOption,
} from "./data";
import { MemberDetailsDialog } from "./member-details-dialog";

type MemberFormState = {
  errors: Partial<Record<string, string[]>>;
  message?: string;
  ok: boolean;
  values: Record<string, string>;
};

type MemberFormValues = {
  birth_date: string;
  email: string;
  gender: string;
  join_date: string;
  name: string;
  national_id: string;
  notes: string;
  phone: string;
  status: string;
};

/** Sentinel for the select, which cannot carry an empty string as a value. */
const NO_COACH_VALUE = "none";

const initialMemberFormState: MemberFormState = {
  errors: {},
  ok: false,
  values: {},
};

type ActionResult = {
  label: string;
  run: (formData: FormData) => Promise<void>;
  success: string;
};

type MemberActionsLabels = {
  actionsFor: (values: { name: string }) => string;
  addPayment: string;
  addPaymentDescription: (values: { balance: string }) => string;
  addSubscription: string;
  addSubscriptionExtra: string;
  addSubscriptionExtraDescription: string;
  bankTransfer: string;
  cancel: string;
  card: string;
  cash: string;
  changePlan: string;
  changePlanDescription: (values: { name: string; plan: string }) => string;
  editMember: string;
  member: string;
  noActivePlan: string;
  outstanding: string;
  paymentMethod: string;
  paymentAmount: string;
  pleaseTryAgain: string;
  selectPaymentMethod: string;
  subscription: string;
  uploadPhoto: string;
  viewDetails: string;
  working: string;
};

type PlanAssignedEmployee = {
  id: number;
  name: string;
  role: string | null;
};

function useActionSubmit({ label, run, success }: ActionResult, close?: () => void) {
  const t = useTranslations("Dashboard.membersPage");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await run(formData);
        toast.success(success);
        close?.();
        router.refresh();
      } catch (error) {
        toast.error(t("failed", { label }), {
          description: error instanceof Error ? error.message : t("pleaseTryAgain"),
        });
      }
    });
  }

  return { pending, submit };
}

export function AddMemberDialog() {
  const t = useTranslations("Dashboard.membersPage");
  const { onOpenChange, open } = useQueryDialog("member", "create");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        <UserPlus data-icon="inline-start" />
        {t("addMember")}
      </DialogTrigger>
      <MemberFormContent
        action={createMember}
        description={t("addMemberDescription")}
        submitLabel={t("createMember")}
        title={t("addMemberTitle")}
        onSuccess={() => onOpenChange(false)}
      />
    </Dialog>
  );
}

export function EditMemberDialog({ member }: { member: MemberRow }) {
  const t = useTranslations("Dashboard.membersPage");
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" className="sr-only" />}>{t("editMember")}</DialogTrigger>
      <MemberFormContent
        action={updateMember}
        description={t("editMemberDescription")}
        member={member}
        submitLabel={t("saveChanges")}
        title={t("editMember")}
        onSuccess={() => setOpen(false)}
      />
    </Dialog>
  );
}

export function MemberPhotoDialog({ member }: { member: MemberRow }) {
  const t = useTranslations("Dashboard.membersPage");
  const [open, setOpen] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const { pending, submit } = useActionSubmit(
    { label: t("uploadPhoto"), run: uploadMemberPhoto, success: t("memberPhotoUpdated") },
    () => {
      setOpen(false);
      setPreviewUrl(null);
    },
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setPreviewUrl(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button type="button" className="sr-only" />}>{t("uploadPhoto")}</DialogTrigger>
      <PhotoDialogContent
        member={member}
        onCancel={() => setOpen(false)}
        pending={pending}
        previewUrl={previewUrl}
        setPreviewUrl={setPreviewUrl}
        submit={submit}
      />
    </Dialog>
  );
}

export function MemberActionsMenu({
  due,
  member,
  plans,
  staff,
  labels,
  permissions,
}: {
  due: MemberDueRow | null;
  permissions: string[];
  member: MemberRow;
  plans: PlanRow[];
  staff: StaffOption[];
  labels?: MemberActionsLabels;
}) {
  const t = useTranslations("Dashboard.membersPage");
  const resolvedLabels = React.useMemo<MemberActionsLabels>(
    () =>
      labels ?? {
        actionsFor: (values) => t("actionsFor", values),
        addPayment: t("addPayment"),
        addPaymentDescription: (values) => t("addPaymentDescription", values),
        addSubscription: t("addSubscription"),
        addSubscriptionExtra: t("addSubscriptionExtra"),
        addSubscriptionExtraDescription: t("addSubscriptionExtraDescription"),
        bankTransfer: t("bankTransfer"),
        cancel: t("cancel"),
        card: t("card"),
        cash: t("cash"),
        changePlan: t("changePlan"),
        changePlanDescription: (values) => t("changePlanDescription", values),
        editMember: t("editMember"),
        member: t("member"),
        noActivePlan: t("noActivePlan"),
        outstanding: t("outstanding"),
        paymentMethod: t("paymentMethod"),
        paymentAmount: t("paymentAmount"),
        pleaseTryAgain: t("pleaseTryAgain"),
        selectPaymentMethod: t("selectPaymentMethod"),
        subscription: t("subscription"),
        uploadPhoto: t("uploadPhoto"),
        viewDetails: t("viewDetails"),
        working: t("working"),
      },
    [labels, t],
  );
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = React.useState(false);
  const [changePlanOpen, setChangePlanOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [lifecycleAction, setLifecycleAction] = React.useState<SubscriptionLifecycleAction | null>(null);
  const [editMembershipOpen, setEditMembershipOpen] = React.useState(false);
  const [history, setHistory] = React.useState<MemberPaymentHistory | null>(null);
  const [payments, setPayments] = React.useState<MemberPaymentRow[]>([]);
  const [report, setReport] = React.useState<MemberReportData | null>(null);
  const [visits, setVisits] = React.useState<MemberVisitRow[]>([]);
  const detailsLoaded = React.useRef(false);
  const currentUser = React.useMemo(() => ({ permissions }), [permissions]);
  const canAddSubscription = canAccess(currentUser, "subscriptions.create");
  const canChangePlan = canAccess(currentUser, "subscriptions.upgrade");
  const canCancelSubscription = canAccess(currentUser, "subscriptions.stop");
  const canForceRefund = canAccess(currentUser, "subscriptions.force_refund");
  const canAddPayment = canAccess(currentUser, "payments.create");
  const canApproveFreeze = canAccess(currentUser, "subscriptions.freeze_approve");
  const canUpdateMember = canAccess(currentUser, "members.update");
  const canDeleteMember = canAccess(currentUser, "members.delete");

  React.useEffect(() => {
    let cancelled = false;

    if (detailsOpen && !detailsLoaded.current) {
      detailsLoaded.current = true;
      void fetchMemberDetails(member.id)
        .then((result) => {
          if (cancelled) {
            return;
          }

          setHistory(result.history);
          setPayments(result.payments);
          setReport(result.report);
          setVisits(result.visits);
        })
        .catch((error) => {
          if (!cancelled) {
            toast.error(resolvedLabels.pleaseTryAgain, {
              description: error instanceof Error ? error.message : undefined,
            });
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [detailsOpen, member.id, resolvedLabels]);

  // An advance sale is a membership the member already owns, it just has not
  // started yet — so it can be changed or refunded, and offering to add another
  // one on top of it would sell the same member two overlapping periods.
  const subscriptionStatus = member.latest_subscription?.status;
  const hasActiveSubscription = subscriptionStatus === "active" || subscriptionStatus === "scheduled";
  const hasCurrentSubscription = hasActiveSubscription || subscriptionStatus === "frozen";
  // Same lifecycle rules the memberships pipeline applies, so the two menus
  // never offer a different set of actions for the same membership.
  const subscriptionId = member.latest_subscription?.id ?? null;
  const lifecycleActions = getSubscriptionLifecycleActions(subscriptionStatus).filter((action) => {
    if (action === "renew") return canAccess(currentUser, "subscriptions.renew");
    if (action === "stop") return canCancelSubscription;
    if (action === "freeze" && member.latest_subscription?.pending_freeze) return false;

    return canAccess(currentUser, "subscriptions.freeze");
  });

  return (
    <>
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="icon-sm" variant="ghost" aria-label={resolvedLabels.actionsFor({ name: member.name })} />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
                <Eye className="mr-2 size-4 text-muted-foreground" />
                {resolvedLabels.viewDetails}
              </DropdownMenuItem>
              {canUpdateMember ? (
                <>
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Pencil className="mr-2 size-4 text-muted-foreground" />
                    {resolvedLabels.editMember}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPhotoOpen(true)}>
                    <Camera className="mr-2 size-4 text-muted-foreground" />
                    {resolvedLabels.uploadPhoto}
                  </DropdownMenuItem>
                </>
              ) : null}
              {member.phone ? (
                <DropdownMenuItem
                  onClick={() => {
                    const url = buildWhatsAppUrl(member.phone, t("whatsAppGreeting", { name: member.name }));

                    if (!url) {
                      toast.error(t("whatsAppNumberMissing"));
                      return;
                    }

                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <MessageCircle className="mr-2 size-4 text-green-600 dark:text-green-400" />
                  {t("sendWhatsApp")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {canChangePlan && hasActiveSubscription ? (
                <DropdownMenuItem onClick={() => setChangePlanOpen(true)}>
                  <CreditCard className="mr-2 size-4 text-blue-600 dark:text-blue-400" />
                  {resolvedLabels.changePlan}
                </DropdownMenuItem>
              ) : null}
              {canChangePlan && subscriptionId ? (
                <DropdownMenuItem onClick={() => setEditMembershipOpen(true)}>
                  <SquarePen className="mr-2 size-4 text-blue-600 dark:text-blue-400" />
                  {t("editMembership")}
                </DropdownMenuItem>
              ) : null}
              {canAddSubscription && !hasCurrentSubscription ? (
                <DropdownMenuItem onClick={() => setSubscriptionOpen(true)}>
                  <PlusCircle className="mr-2 size-4 text-emerald-600 dark:text-emerald-400" />
                  {resolvedLabels.addSubscription}
                </DropdownMenuItem>
              ) : null}
              {canAddPayment && due && Number.parseFloat(due.balance) > 0 ? (
                <DropdownMenuItem onClick={() => setPaymentOpen(true)}>
                  <Receipt className="mr-2 size-4 text-amber-600 dark:text-amber-400" />
                  {resolvedLabels.addPayment}
                </DropdownMenuItem>
              ) : null}
              {canCancelSubscription && hasActiveSubscription ? (
                <DropdownMenuItem onClick={() => setCancelOpen(true)}>
                  <Ban className="mr-2 size-4 text-rose-600 dark:text-rose-400" />
                  {t("cancelWithRefund")}
                </DropdownMenuItem>
              ) : null}
              {subscriptionId
                ? lifecycleActions.map((action) => (
                    <DropdownMenuItem
                      key={action}
                      variant={action === "stop" ? "destructive" : "default"}
                      onClick={() => setLifecycleAction(action)}
                    >
                      {getLifecycleIcon(action)}
                      {t(`lifecycle.${action}`)}
                    </DropdownMenuItem>
                  ))
                : null}
            </DropdownMenuGroup>
            {canDeleteMember ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DeactivateMemberItem member={member} />
                </DropdownMenuGroup>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <MemberDetailsDialog
        history={history}
        member={member}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        payments={payments}
        report={report}
        requestReportShareLink={createMemberReportShareLink}
        visits={visits}
      />
      <EditMemberControlledDialog member={member} open={editOpen} onOpenChange={setEditOpen} />
      <MemberPhotoControlledDialog member={member} open={photoOpen} onOpenChange={setPhotoOpen} />
      <MemberSubscriptionDialog
        member={member}
        plans={plans}
        staff={staff}
        open={subscriptionOpen}
        onOpenChange={setSubscriptionOpen}
      />
      <MemberChangePlanDialog
        member={member}
        plans={plans}
        staff={staff}
        open={changePlanOpen}
        onOpenChange={setChangePlanOpen}
      />
      <MemberCancelSubscriptionDialog
        canForceRefund={canForceRefund}
        member={member}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
      <MemberPaymentDialog
        due={due}
        member={member}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        labels={resolvedLabels}
      />
      {subscriptionId ? (
        <MemberEditMembershipDialog
          member={member}
          open={editMembershipOpen}
          onOpenChange={setEditMembershipOpen}
          plans={plans}
          staff={staff}
        />
      ) : null}
      {subscriptionId ? (
        <MemberLifecycleDialog
          action={lifecycleAction}
          canApproveFreeze={canApproveFreeze}
          member={member}
          onOpenChange={(next) => {
            if (!next) {
              setLifecycleAction(null);
            }
          }}
          plans={plans}
          staff={staff}
          subscriptionId={subscriptionId}
        />
      ) : null}
    </>
  );
}

/**
 * Corrects the member-specific snapshot captured at checkout: schedule,
 * session allowance, price/discount, and cancellation window. Plan identity,
 * lifecycle transitions, and collected money keep their dedicated audited
 * workflows instead of being silently rewritten by this form.
 */
export function MemberEditMembershipDialog({
  member,
  onOpenChange,
  open,
  plans,
  staff,
}: {
  member: MemberRow;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  plans?: PlanRow[];
  staff?: StaffOption[];
}) {
  const t = useTranslations("Dashboard.membersPage");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const subscription = member.latest_subscription;
  const subscriptionPlan = plans?.find((plan) => plan.id === subscription?.plan_id);
  // Only coaches who run this plan — moving a member to someone who does not
  // would leave their coaching credit with nowhere to land, and the API refuses it.
  const coachOptions = getAssignedEmployees(subscriptionPlan);
  const currentCoach = subscription?.coach ?? null;
  // A coach who has since been unassigned from the plan still has to appear, or
  // reopening the dialog would silently blank out who is actually on the membership.
  const coachChoices =
    currentCoach && !coachOptions.some((option) => option.id === currentCoach.id)
      ? [{ id: currentCoach.id, name: currentCoach.name, role: currentCoach.role ?? null }, ...coachOptions]
      : coachOptions;
  const [coachId, setCoachId] = React.useState(subscription?.coach_id ? String(subscription.coach_id) : NO_COACH_VALUE);
  const [startDate, setStartDate] = React.useState(subscription?.start_date ?? "");
  const [endDate, setEndDate] = React.useState(subscription?.end_date ?? "");
  const [durationDays, setDurationDays] = React.useState(
    String(calculateMembershipDurationDays(subscription?.start_date, subscription?.end_date) ?? ""),
  );
  const [price, setPrice] = React.useState(String(subscription?.price_paid ?? "0"));
  const [discount, setDiscount] = React.useState(String(subscription?.discount ?? "0"));
  const [cancellationGraceDays, setCancellationGraceDays] = React.useState(
    String(subscription?.cancellation_grace_days ?? 2),
  );
  const [unlimitedSessions, setUnlimitedSessions] = React.useState(
    subscription?.sessions_total == null && subscription?.sessions_remaining == null,
  );
  const [sessionsTotal, setSessionsTotal] = React.useState(
    subscription?.sessions_total == null ? "" : String(subscription.sessions_total),
  );
  const [sessionsRemaining, setSessionsRemaining] = React.useState(
    subscription?.sessions_remaining == null ? "" : String(subscription.sessions_remaining),
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }

    // Always reopen showing what is actually stored, never a half-finished edit
    // from the last time it was opened and dismissed.
    setStartDate(subscription?.start_date ?? "");
    setEndDate(subscription?.end_date ?? "");
    setDurationDays(String(calculateMembershipDurationDays(subscription?.start_date, subscription?.end_date) ?? ""));
    setPrice(String(subscription?.price_paid ?? "0"));
    setDiscount(String(subscription?.discount ?? "0"));
    setCancellationGraceDays(String(subscription?.cancellation_grace_days ?? 2));
    setUnlimitedSessions(subscription?.sessions_total == null && subscription?.sessions_remaining == null);
    setSessionsTotal(subscription?.sessions_total == null ? "" : String(subscription.sessions_total));
    setSessionsRemaining(subscription?.sessions_remaining == null ? "" : String(subscription.sessions_remaining));
    setCoachId(subscription?.coach_id ? String(subscription.coach_id) : NO_COACH_VALUE);
  }, [
    open,
    subscription?.cancellation_grace_days,
    subscription?.coach_id,
    subscription?.discount,
    subscription?.end_date,
    subscription?.price_paid,
    subscription?.sessions_remaining,
    subscription?.sessions_total,
    subscription?.start_date,
  ]);

  const paidSoFar = Number(subscription?.paid_total ?? 0);
  const nextPrice = Number(price);
  const nextDiscount = Number(discount);
  const hasValidPrice = price.trim() !== "" && Number.isFinite(nextPrice) && nextPrice >= 0;
  const hasValidDiscount = discount.trim() !== "" && Number.isFinite(nextDiscount) && nextDiscount >= 0;
  const nextBalance = hasValidPrice ? Math.max(0, nextPrice - paidSoFar) : 0;
  const parsedDurationDays = parseNonNegativeInteger(durationDays);
  const parsedCancellationGraceDays = parseNonNegativeInteger(cancellationGraceDays);
  const parsedSessionsTotal = parseNonNegativeInteger(sessionsTotal);
  const parsedSessionsRemaining = parseNonNegativeInteger(sessionsRemaining);
  const hasValidSessions =
    unlimitedSessions ||
    (parsedSessionsTotal !== null &&
      parsedSessionsRemaining !== null &&
      parsedSessionsRemaining <= parsedSessionsTotal);
  const sessionsRemainingExceedsTotal =
    !unlimitedSessions &&
    parsedSessionsTotal !== null &&
    parsedSessionsRemaining !== null &&
    parsedSessionsRemaining > parsedSessionsTotal;
  const sessionsUsed =
    !unlimitedSessions && parsedSessionsTotal !== null && parsedSessionsRemaining !== null
      ? Math.max(0, parsedSessionsTotal - parsedSessionsRemaining)
      : null;
  const endsBeforeStart = Boolean(startDate && endDate && endDate < startDate);
  const hasValidSchedule = Boolean(startDate && endDate && parsedDurationDays !== null && !endsBeforeStart);
  const canSubmit =
    Boolean(subscription?.id) &&
    hasValidSchedule &&
    hasValidPrice &&
    hasValidDiscount &&
    parsedCancellationGraceDays !== null &&
    hasValidSessions;
  let endDateError: string | undefined;
  let sessionsRemainingError: string | undefined;

  if (!endDate) {
    endDateError = t("dateRequired");
  } else if (endsBeforeStart) {
    endDateError = t("endBeforeStart");
  }

  if (parsedSessionsRemaining === null) {
    sessionsRemainingError = t("wholeNumberRequired");
  } else if (sessionsRemainingExceedsTotal) {
    sessionsRemainingError = t("sessionsRemainingExceedsTotal");
  }

  function changeStartDate(value: string) {
    setStartDate(value);

    const parsedStart = parseDateOnly(value);

    if (parsedStart && parsedDurationDays !== null) {
      setEndDate(formatDateOnly(addDays(parsedStart, parsedDurationDays)));
    }
  }

  function changeEndDate(value: string) {
    setEndDate(value);
    const nextDuration = calculateMembershipDurationDays(startDate, value);
    setDurationDays(nextDuration === null ? "" : String(nextDuration));
  }

  function changeDurationDays(value: string) {
    setDurationDays(value);
    const nextDuration = parseNonNegativeInteger(value);
    const parsedStart = parseDateOnly(startDate);

    if (parsedStart && nextDuration !== null) {
      setEndDate(formatDateOnly(addDays(parsedStart, nextDuration)));
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!subscription?.id || !canSubmit || parsedCancellationGraceDays === null) {
      return;
    }

    startTransition(async () => {
      const result = await correctMembershipSubscription(subscription.id, {
        cancellation_grace_days: parsedCancellationGraceDays,
        coach_id: coachId === NO_COACH_VALUE ? null : Number(coachId),
        discount,
        end_date: endDate,
        price_paid: price,
        sessions_remaining: unlimitedSessions ? null : parsedSessionsRemaining,
        sessions_total: unlimitedSessions ? null : parsedSessionsTotal,
        start_date: startDate,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("editMembership")}</DialogTitle>
          <DialogDescription>
            {t("editMembershipDescription", { plan: subscription?.plan_name ?? t("noActivePlan") })}
          </DialogDescription>
        </DialogHeader>
        <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={submit}>
          <div className="-mx-4 grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="font-medium text-sm">{subscription?.plan_name ?? t("noActivePlan")}</p>
              <p className="mt-1 text-muted-foreground text-xs">{t("editMembershipPlanHint")}</p>
            </div>

            <div className="grid gap-3 rounded-lg border p-4">
              <div>
                <p className="font-medium text-sm">{t("assignedCoach")}</p>
                <p className="text-muted-foreground text-xs">{t("assignedCoachHelp")}</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-membership-coach">{t("coach")}</Label>
                <FormSelect
                  id="edit-membership-coach"
                  name="coach_id"
                  value={coachId}
                  onValueChange={(value) => setCoachId(value || NO_COACH_VALUE)}
                  placeholder={t("selectCoach")}
                  options={[
                    { label: t("noCoach"), value: NO_COACH_VALUE },
                    ...coachChoices.map((coach) => ({
                      label: coach.role ? `${coach.name} — ${coach.role}` : coach.name,
                      value: String(coach.id),
                    })),
                  ]}
                />
                {coachChoices.length === 0 ? (
                  <p className="text-muted-foreground text-xs">{t("noCoachesOnPlan")}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border p-4">
              <div>
                <p className="font-medium text-sm">{t("membershipSchedule")}</p>
                <p className="text-muted-foreground text-xs">{t("membershipScheduleHelp")}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-membership-start">{t("startDate")}</Label>
                  <FormDatePicker
                    id="edit-membership-start"
                    name="start_date"
                    value={startDate}
                    onValueChange={changeStartDate}
                    error={!startDate ? t("dateRequired") : undefined}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-membership-end">{t("endDate")}</Label>
                  <FormDatePicker
                    id="edit-membership-end"
                    name="end_date"
                    value={endDate}
                    onValueChange={changeEndDate}
                    error={endDateError}
                  />
                </div>
                <Field
                  error={parsedDurationDays === null ? t("wholeNumberRequired") : undefined}
                  help={t("durationDaysHelp")}
                  label={t("durationDays")}
                  min="0"
                  name="duration_days"
                  onChange={(event) => changeDurationDays(event.currentTarget.value)}
                  required
                  step="1"
                  type="number"
                  value={durationDays}
                />
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border p-4">
              <div>
                <p className="font-medium text-sm">{t("sessionAccess")}</p>
                <p className="text-muted-foreground text-xs">{t("sessionAccessHelp")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-membership-unlimited"
                  checked={unlimitedSessions}
                  onCheckedChange={(checked) => setUnlimitedSessions(checked === true)}
                />
                <Label htmlFor="edit-membership-unlimited">{t("unlimitedSessionAccess")}</Label>
              </div>
              {!unlimitedSessions ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    error={parsedSessionsTotal === null ? t("wholeNumberRequired") : undefined}
                    label={t("sessionsTotal")}
                    min="0"
                    name="sessions_total"
                    onChange={(event) => setSessionsTotal(event.currentTarget.value)}
                    required
                    step="1"
                    type="number"
                    value={sessionsTotal}
                  />
                  <Field
                    error={sessionsRemainingError}
                    label={t("sessionsRemainingEdit")}
                    min="0"
                    name="sessions_remaining"
                    onChange={(event) => setSessionsRemaining(event.currentTarget.value)}
                    required
                    step="1"
                    type="number"
                    value={sessionsRemaining}
                  />
                  {sessionsUsed !== null ? (
                    <p className="text-muted-foreground text-xs sm:col-span-2">
                      {t("sessionsUsedSummary", { count: sessionsUsed })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 rounded-lg border p-4">
              <div>
                <p className="font-medium text-sm">{t("membershipBilling")}</p>
                <p className="text-muted-foreground text-xs">{t("membershipBillingHelp")}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  error={!hasValidPrice ? t("nonNegativeAmountRequired") : undefined}
                  label={t("membershipPrice")}
                  min="0"
                  name="price_paid"
                  onChange={(event) => setPrice(event.currentTarget.value)}
                  required
                  step="0.01"
                  type="number"
                  value={price}
                />
                <Field
                  error={!hasValidDiscount ? t("nonNegativeAmountRequired") : undefined}
                  help={t("recordedDiscountHelp")}
                  label={t("recordedDiscount")}
                  min="0"
                  name="discount"
                  onChange={(event) => setDiscount(event.currentTarget.value)}
                  required
                  step="0.01"
                  type="number"
                  value={discount}
                />
              </div>
              <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("paidSoFar")}</span>
                  <span className="font-medium">{formatCurrency(paidSoFar, { currency: "EGP" })}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("balanceDue")}</span>
                  <span className={cn("font-medium", nextBalance > 0 && "text-amber-600 dark:text-amber-400")}>
                    {formatCurrency(nextBalance, { currency: "EGP" })}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">{t("editMembershipPaymentsHint")}</p>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border p-4">
              <div>
                <p className="font-medium text-sm">{t("membershipRules")}</p>
                <p className="text-muted-foreground text-xs">{t("membershipRulesHelp")}</p>
              </div>
              <Field
                error={parsedCancellationGraceDays === null ? t("wholeNumberRequired") : undefined}
                help={t("cancellationGraceDaysEditHelp")}
                label={t("cancellationGraceDaysEdit")}
                max="3650"
                min="0"
                name="cancellation_grace_days"
                onChange={(event) => setCancellationGraceDays(event.currentTarget.value)}
                required
                step="1"
                type="number"
                value={cancellationGraceDays}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending ? t("working") : t("saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type SubscriptionLifecycleAction = "renew" | "freeze" | "unfreeze" | "stop";

/**
 * Mirrors getBackendActions() in the memberships pipeline. An advance sale is a
 * live membership on the API side, so it offers the same actions as a running
 * one — staff must be able to stop a period the member no longer wants.
 */
function getSubscriptionLifecycleActions(status: string | null | undefined): SubscriptionLifecycleAction[] {
  switch (status) {
    case "active":
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

function getLifecycleIcon(action: SubscriptionLifecycleAction) {
  if (action === "renew") {
    return <RefreshCw className="mr-2 size-4 text-emerald-600 dark:text-emerald-400" />;
  }

  if (action === "freeze") {
    return <Snowflake className="mr-2 size-4 text-sky-600 dark:text-sky-400" />;
  }

  if (action === "unfreeze") {
    return <Play className="mr-2 size-4 text-sky-600 dark:text-sky-400" />;
  }

  return <CircleStop className="mr-2 size-4 text-rose-600 dark:text-rose-400" />;
}

/**
 * Renew / freeze / unfreeze / stop, driven from the members and overview tables.
 * The memberships pipeline runs the same server actions; this is the same work
 * without the pipeline row, so it reprices renewals from the plan catalogue
 * rather than from a column the member payload does not carry.
 */
function MemberLifecycleDialog({
  action,
  canApproveFreeze,
  member,
  onOpenChange,
  plans,
  staff,
  subscriptionId,
}: {
  action: SubscriptionLifecycleAction | null;
  canApproveFreeze: boolean;
  member: MemberRow;
  onOpenChange: (open: boolean) => void;
  plans: PlanRow[];
  staff: StaffOption[];
  subscriptionId: number;
}) {
  const t = useTranslations("Dashboard.membersPage");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const today = React.useMemo(() => getGymTodayString(), []);
  const currentPlan = plans.find((plan) => plan.id === member.latest_subscription?.plan_id);
  // Read as values, not as an object: the form resets when the member's plan
  // changes, not every time the parent hands us a fresh copy of the same plans.
  const currentPlanId = currentPlan?.id;
  const currentPlanPrice = currentPlan?.price;
  const currentPlanSessions = currentPlan?.sessions_count;
  const currentPlanUnlimited = currentPlan?.is_unlimited_sessions;
  const [planId, setPlanId] = React.useState(currentPlan ? String(currentPlan.id) : "");
  const [coachId, setCoachId] = React.useState("");
  const [price, setPrice] = React.useState("0");
  const [amount, setAmount] = React.useState("0");
  const [discount, setDiscount] = React.useState("0");
  const [endDate, setEndDate] = React.useState("");
  // The plan decides the end date unless somebody moves it. Posting a date we
  // worked out ourselves would read as a custom period on every renewal.
  const [endDateTouched, setEndDateTouched] = React.useState(false);
  const [unlimitedSessions, setUnlimitedSessions] = React.useState(false);
  const [sessionsTotal, setSessionsTotal] = React.useState("");
  const [extendDaysForOverpayment, setExtendDaysForOverpayment] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<"cash" | "card" | "bank_transfer">("cash");
  const [freezeStart, setFreezeStart] = React.useState(today);
  const [freezeEnd, setFreezeEnd] = React.useState(today);
  const [resumeOn, setResumeOn] = React.useState(today);
  const [reason, setReason] = React.useState("");

  const selectedPlan = plans.find((plan) => String(plan.id) === planId) ?? currentPlan;
  // Mirrors RenewSubscription: a live period is stacked on, anything else
  // restarts today.
  const renewalStart = React.useMemo(() => {
    const subscription = member.latest_subscription;
    const currentEnd = subscription?.end_date ? parseDateOnly(subscription.end_date) : null;

    if (!currentEnd || ["stopped", "expired"].includes(subscription?.status ?? "")) {
      return today;
    }

    return currentEnd >= (parseDateOnly(today) ?? currentEnd) ? formatDateOnly(addDays(currentEnd, 1)) : today;
  }, [member.latest_subscription, today]);
  const planDefaultEnd = planEndDateFrom(selectedPlan, renewalStart);
  const effectiveEndDate = endDateTouched && endDate ? endDate : planDefaultEnd;
  const totalDue = Math.max(0, (Number(price) || 0) - (Number(discount) || 0));
  const overpayment = Math.max(0, (Number(amount) || 0) - totalDue);
  const renewalDurationDays = calculateMembershipDurationDays(renewalStart, effectiveEndDate);
  // Same arithmetic the API uses to turn money into time, so the desk is told
  // what it is about to buy rather than finding out afterwards.
  const extraDaysFromOverpayment =
    overpayment > 0 && totalDue > 0 && renewalDurationDays && renewalDurationDays > 0
      ? Math.floor(overpayment / (totalDue / renewalDurationDays))
      : 0;
  const endsBeforeStart = Boolean(effectiveEndDate && effectiveEndDate < renewalStart);

  function applyPlanDefaults(plan: PlanRow | undefined) {
    setPrice(plan?.price ? String(plan.price) : "0");
    setAmount(plan?.price ? String(plan.price) : "0");
    setUnlimitedSessions(Boolean(plan?.is_unlimited_sessions) || plan?.sessions_count == null);
    setSessionsTotal(plan?.sessions_count == null ? "" : String(plan.sessions_count));
    setEndDate("");
    setEndDateTouched(false);
  }

  React.useEffect(() => {
    if (action === null) {
      return;
    }

    // Reprice every time it opens — a stale amount left over from a previous
    // attempt would quietly under- or over-charge the new period.
    setPlanId(currentPlanId ? String(currentPlanId) : "");
    setCoachId("");
    setDiscount("0");
    setPaymentMethod("cash");
    setExtendDaysForOverpayment(false);
    setPrice(currentPlanPrice ? String(currentPlanPrice) : "0");
    setAmount(currentPlanPrice ? String(currentPlanPrice) : "0");
    setUnlimitedSessions(Boolean(currentPlanUnlimited) || currentPlanSessions == null);
    setSessionsTotal(currentPlanSessions == null ? "" : String(currentPlanSessions));
    setEndDate("");
    setEndDateTouched(false);
    setFreezeStart(today);
    setFreezeEnd(today);
    setResumeOn(today);
    setReason("");
  }, [action, currentPlanId, currentPlanPrice, currentPlanSessions, currentPlanUnlimited, today]);

  function finish(result: { ok: boolean; message: string }) {
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message);
    onOpenChange(false);
    router.refresh();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      if (action === "renew") {
        let sessionOverride: { unlimited_sessions: true } | { sessions_total: number } | Record<string, never> = {};

        if (unlimitedSessions) {
          sessionOverride = { unlimited_sessions: true };
        } else if (sessionsTotal.trim()) {
          sessionOverride = { sessions_total: Number(sessionsTotal) };
        }

        finish(
          await renewMembershipSubscription(subscriptionId, {
            discount,
            payment: {
              amount,
              method: paymentMethod,
              ...(extendDaysForOverpayment ? { extend_days_for_overpayment: true } : {}),
            },
            ...(selectedPlan ? { plan_id: selectedPlan.id } : {}),
            ...(coachId ? { coach_id: Number(coachId) } : {}),
            ...(price.trim() ? { price } : {}),
            ...(endDateTouched && endDate ? { end_date: endDate } : {}),
            ...sessionOverride,
          }),
        );
        return;
      }

      if (action === "freeze") {
        finish(
          await freezeMembershipSubscription(subscriptionId, {
            freeze_start: freezeStart,
            freeze_end: freezeEnd,
            ...(reason ? { reason } : {}),
          }),
        );
        return;
      }

      if (action === "unfreeze") {
        finish(await unfreezeMembershipSubscription(subscriptionId, { resume_on: resumeOn }));
        return;
      }

      finish(await stopMembershipSubscription(subscriptionId));
    });
  }

  const actionLabel = action ? t(`lifecycle.${action}`) : "";
  const submitLabel =
    action === "freeze" && currentPlan?.freeze_requires_approval ? t("requestFreezeApproval") : actionLabel;

  return (
    <Dialog open={action !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{actionLabel}</DialogTitle>
          <DialogDescription>
            {action ? t(`lifecycleDescription.${action}`, { name: member.name }) : ""}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          {action === "renew" ? (
            <div className="-mx-4 grid max-h-[60vh] content-start gap-4 overflow-y-auto px-4">
              <div className="grid gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium text-sm">{t("renewTerms")}</p>
                  <p className="text-muted-foreground text-xs">{t("renewTermsHelp")}</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="member-renew-plan">{t("plan")}</Label>
                  <FormSelect
                    id="member-renew-plan"
                    name="renew_plan"
                    value={planId}
                    onValueChange={(value) => {
                      setPlanId(value);
                      applyPlanDefaults(plans.find((plan) => String(plan.id) === value));
                    }}
                    placeholder={t("selectPlan")}
                    options={plans
                      .filter((plan) => plan.is_sellable || plan.id === currentPlan?.id)
                      .map((plan) => ({ value: String(plan.id), label: plan.name }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="member-renew-coach">{t("coach")}</Label>
                  <FormSelect
                    id="member-renew-coach"
                    name="renew_coach"
                    value={coachId}
                    onValueChange={setCoachId}
                    placeholder={t("keepCurrentCoach")}
                    options={getPlanCoachOptions(selectedPlan, plans, staff).map((employee) => ({
                      value: String(employee.id),
                      label: employee.name,
                    }))}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    help={t("renewPriceHelp", { price: selectedPlan?.price ?? "0" })}
                    label={t("membershipPrice")}
                    min="0"
                    name="renew_price"
                    onChange={(event) => setPrice(event.currentTarget.value)}
                    required
                    step="0.01"
                    type="number"
                    value={price}
                  />
                  <Field
                    label={t("discount")}
                    min="0"
                    name="renew_discount"
                    onChange={(event) => setDiscount(event.currentTarget.value)}
                    step="0.01"
                    type="number"
                    value={discount}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="member-renew-end">{t("endDate")}</Label>
                  <FormDatePicker
                    id="member-renew-end"
                    name="renew_end_date"
                    value={effectiveEndDate}
                    onValueChange={(value) => {
                      setEndDate(value);
                      setEndDateTouched(true);
                    }}
                    error={endsBeforeStart ? t("endBeforeStart") : undefined}
                  />
                  <p className="text-muted-foreground text-xs">
                    {t("renewPeriodHint", {
                      days: renewalDurationDays ?? 0,
                      start: renewalStart,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="member-renew-unlimited"
                    checked={unlimitedSessions}
                    onCheckedChange={(checked) => setUnlimitedSessions(checked === true)}
                  />
                  <Label htmlFor="member-renew-unlimited">{t("unlimitedSessionAccess")}</Label>
                </div>
                {!unlimitedSessions ? (
                  <Field
                    label={t("sessionsTotal")}
                    min="0"
                    name="renew_sessions_total"
                    onChange={(event) => setSessionsTotal(event.currentTarget.value)}
                    step="1"
                    type="number"
                    value={sessionsTotal}
                  />
                ) : null}
              </div>

              <div className="grid gap-3 rounded-lg border p-4">
                <Field
                  label={t("paymentAmount")}
                  min="0"
                  name="renew_amount"
                  onChange={(event) => setAmount(event.currentTarget.value)}
                  required
                  step="0.01"
                  type="number"
                  value={amount}
                />
                <div className="grid gap-2">
                  <Label htmlFor="member-renew-method">{t("paymentMethod")}</Label>
                  <FormSelect
                    id="member-renew-method"
                    name="renew_method"
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod((value as "cash" | "card" | "bank_transfer") || "cash")}
                    options={[
                      { value: "cash", label: t("cash") },
                      { value: "card", label: t("card") },
                      { value: "bank_transfer", label: t("bankTransfer") },
                    ]}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{t("totalDue")}</span>
                  <span className="font-medium">{formatCurrency(totalDue, { currency: "EGP" })}</span>
                </div>
                {overpayment > 0 ? (
                  <OverpaymentChoice
                    checked={extendDaysForOverpayment}
                    extraDays={extraDaysFromOverpayment}
                    id="member-renew-extend"
                    onCheckedChange={setExtendDaysForOverpayment}
                    overpayment={overpayment}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
          {action === "freeze" ? (
            <>
              {currentPlan?.freeze_requires_approval ? (
                <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-amber-700 text-xs dark:text-amber-300">
                  {t("freezeApprovalWillRequest")} {canApproveFreeze ? t("freezeApprovalGranted") : null}
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="member-freeze-start">{t("freezeStart")}</Label>
                <FormDatePicker
                  id="member-freeze-start"
                  name="freeze_start"
                  value={freezeStart}
                  onValueChange={setFreezeStart}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="member-freeze-end">{t("freezeEnd")}</Label>
                <FormDatePicker
                  id="member-freeze-end"
                  name="freeze_end"
                  value={freezeEnd}
                  onValueChange={setFreezeEnd}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="member-freeze-reason">{t("optionalNote")}</Label>
                <Textarea
                  id="member-freeze-reason"
                  name="reason"
                  value={reason}
                  onChange={(event) => setReason(event.currentTarget.value)}
                />
              </div>
            </>
          ) : null}
          {action === "unfreeze" ? (
            <div className="grid gap-2">
              <Label htmlFor="member-resume-on">{t("resumeOn")}</Label>
              <FormDatePicker id="member-resume-on" name="resume_on" value={resumeOn} onValueChange={setResumeOn} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending} variant={action === "stop" ? "destructive" : "default"}>
              {pending ? t("working") : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberCancelSubscriptionDialog({
  canForceRefund,
  member,
  onOpenChange,
  open,
}: {
  canForceRefund: boolean;
  member: MemberRow;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useTranslations("Dashboard.membersPage");
  const router = useRouter();
  const [state, submit, pending] = useActionState(cancelMemberSubscription, initialMemberFormState);
  const subscription = member.latest_subscription;

  const defaultRefund = String(
    subscription?.default_refund_amount ??
      subscription?.package_paid_total ??
      subscription?.paid_total ??
      subscription?.price_paid ??
      "0",
  );
  const [refundAmount, setRefundAmount] = React.useState(defaultRefund);
  const [refundAddonId, setRefundAddonId] = React.useState<string>("");
  const [refundScope, setRefundScope] = React.useState<"full_package" | "main_plan">("full_package");

  React.useEffect(() => {
    if (subscription) {
      setRefundAddonId("");
      setRefundScope("full_package");
      setRefundAmount(
        String(
          subscription.default_refund_amount ??
            subscription.package_paid_total ??
            subscription.paid_total ??
            subscription.price_paid ??
            "0",
        ),
      );
    }
  }, [subscription]);

  React.useEffect(() => {
    if (!state.ok) {
      return;
    }

    toast.success(state.message ?? t("cancelWithRefund"));
    onOpenChange(false);
    router.refresh();
  }, [onOpenChange, router, state.message, state.ok, t]);

  if (!subscription) {
    return null;
  }

  const mainPlanPrice = Number(subscription.price_paid ?? 0);
  const addons = subscription.addons ?? [];
  const addonsTotal = addons.reduce((sum, a) => sum + Number(a.price_paid ?? 0), 0);
  const packageTotal = Number(subscription.package_paid_total ?? mainPlanPrice + addonsTotal);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cancelWithRefund")}</DialogTitle>
          <DialogDescription>
            {t("cancelWithRefundDescription", {
              date: subscription.cancellation_grace_ends_on ?? "—",
              name: member.name,
            })}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <input type="hidden" name="subscription_id" value={String(subscription.id)} />
          <input type="hidden" name="refund_addon_id" value={refundAddonId} />
          <input type="hidden" name="refund_scope" value={refundScope} />
          {state.message && !state.ok ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
              {state.message}
            </div>
          ) : null}

          <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs">
            <div className="font-semibold text-foreground text-xs uppercase tracking-wider">
              Subscription & Attendance Summary
            </div>

            <div className="flex justify-between border-b pt-1 pb-1.5">
              <span className="text-muted-foreground">Main Plan ({subscription.plan_name ?? t("noPlan")}):</span>
              <span className="font-medium tabular-nums">{formatCurrency(mainPlanPrice, { currency: "EGP" })}</span>
            </div>

            {addons.map((addon) => (
              <div key={addon.id} className="flex justify-between border-b pb-1.5">
                <span className="text-muted-foreground">
                  + Extra: {addon.plan?.name ?? "Addon"}
                  {addon.coach?.name ? ` (${addon.coach.name})` : ""}
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(Number(addon.price_paid ?? 0), { currency: "EGP" })}
                </span>
              </div>
            ))}

            <div className="flex justify-between pt-1 font-semibold text-foreground">
              <span>Total Package Paid:</span>
              <span className="tabular-nums">{formatCurrency(packageTotal, { currency: "EGP" })}</span>
            </div>

            <div className="mt-2 grid gap-1.5 rounded-sm border bg-background p-2.5">
              <div className="font-semibold text-[11px] text-foreground uppercase tracking-wider">
                Member Session Attendance Details
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Gym Visits (This Month):</span>
                <span className="font-semibold text-foreground">{member.visits_this_month ?? 0} visit(s)</span>
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>Main Plan Sessions:</span>
                <span className="font-medium text-foreground">
                  {subscription.sessions_remaining !== null && subscription.sessions_remaining !== undefined
                    ? `${
                        subscription.sessions_total
                          ? Math.max(0, subscription.sessions_total - subscription.sessions_remaining)
                          : 0
                      } attended (${subscription.sessions_remaining}/${subscription.sessions_total ?? "—"} remaining)`
                    : "Unlimited sessions"}
                </span>
              </div>

              {addons.map((addon) => (
                <div key={addon.id} className="flex justify-between text-muted-foreground">
                  <span>
                    {addon.plan?.name ?? "Extra Plan"}
                    {addon.coach?.name ? ` (${addon.coach.name})` : ""}:
                  </span>
                  <span className="font-medium text-foreground">
                    {addon.sessions_remaining !== null && addon.sessions_remaining !== undefined
                      ? `${
                          addon.sessions_total ? Math.max(0, addon.sessions_total - addon.sessions_remaining) : 0
                        } attended (${addon.sessions_remaining}/${addon.sessions_total ?? "—"} remaining)`
                      : "Unlimited sessions"}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="w-full font-medium text-[11px] text-muted-foreground">Quick Select Refund:</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  setRefundAddonId("");
                  setRefundScope("full_package");
                  setRefundAmount(packageTotal.toFixed(2));
                }}
              >
                Full Package ({formatCurrency(packageTotal, { currency: "EGP", noDecimals: true })})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  setRefundAddonId("");
                  setRefundScope("main_plan");
                  setRefundAmount(mainPlanPrice.toFixed(2));
                }}
              >
                Main Plan Only ({formatCurrency(mainPlanPrice, { currency: "EGP", noDecimals: true })})
              </Button>
              {addons.map((addon) => (
                <Button
                  key={addon.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    setRefundAddonId(String(addon.id));
                    setRefundScope("full_package");
                    setRefundAmount(String(addon.paid_total ?? addon.price_paid ?? "0"));
                  }}
                >
                  Refund {addon.plan?.name ?? "Extra"}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="refund_amount">{t("refundAmount")}</Label>
            <Input
              id="refund_amount"
              name="refund_amount"
              type="number"
              min="0"
              step="0.01"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              required
            />
            <FieldError errors={state.errors.refund_amount} />
          </div>
          {canForceRefund ? (
            <label className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <input className="mt-0.5" name="force" type="checkbox" value="true" />
              <span>
                <span className="block font-medium">Force refund after grace period</span>
                <span className="text-muted-foreground text-xs">
                  Use only when a manager-approved exception is required.
                </span>
              </span>
            </label>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="method">{t("paymentMethod")}</Label>
            <FormSelect
              id="method"
              name="method"
              defaultValue="cash"
              options={[
                { value: "cash", label: t("cash") },
                { value: "card", label: t("card") },
                { value: "bank_transfer", label: t("bankTransfer") },
              ]}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason">{t("reason")}</Label>
            <Textarea id="reason" name="reason" rows={2} placeholder={t("optionalNote")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? t("working") : t("cancelWithRefund")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditMemberControlledDialog({
  member,
  onOpenChange,
  open,
}: {
  member: MemberRow;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useTranslations("Dashboard.membersPage");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MemberFormContent
        action={updateMember}
        description={t("editMemberDescription")}
        member={member}
        submitLabel={t("saveChanges")}
        title={t("editMember")}
        onSuccess={() => onOpenChange(false)}
      />
    </Dialog>
  );
}

export function MemberPhotoControlledDialog({
  member,
  onOpenChange,
  open,
}: {
  member: MemberRow;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useTranslations("Dashboard.membersPage");
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const { pending, submit } = useActionSubmit(
    { label: t("uploadPhoto"), run: uploadMemberPhoto, success: t("memberPhotoUpdated") },
    () => {
      onOpenChange(false);
      setPreviewUrl(null);
    },
  );

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setPreviewUrl(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <PhotoDialogContent
        member={member}
        onCancel={() => onOpenChange(false)}
        pending={pending}
        previewUrl={previewUrl}
        setPreviewUrl={setPreviewUrl}
        submit={submit}
      />
    </Dialog>
  );
}

export function MemberSubscriptionDialog({
  member,
  onOpenChange,
  open,
  plans,
  staff = [],
}: {
  member: MemberRow;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  plans: PlanRow[];
  staff?: StaffOption[];
}) {
  const t = useTranslations("Dashboard.membersPage");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SubscriptionFormContent
        action={createMemberSubscription}
        member={member}
        onCancel={() => onOpenChange(false)}
        open={open}
        plans={plans}
        staff={staff}
        submitLabel={t("addSubscription")}
        title={t("addSubscription")}
        description={t("addSubscriptionDescription", { name: member.name })}
        kind="create"
      />
    </Dialog>
  );
}

export function MemberChangePlanDialog({
  member,
  onOpenChange,
  open,
  plans,
  staff = [],
}: {
  member: MemberRow;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  plans: PlanRow[];
  staff?: StaffOption[];
}) {
  const t = useTranslations("Dashboard.membersPage");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SubscriptionFormContent
        action={changeMemberPlan}
        member={member}
        onCancel={() => onOpenChange(false)}
        open={open}
        plans={plans}
        staff={staff}
        submitLabel={t("changePlan")}
        title={t("changePlan")}
        description={t("changePlanDescription", {
          name: member.name,
          plan: member.latest_subscription?.plan_name ?? t("noActivePlan"),
        })}
        kind="change"
      />
    </Dialog>
  );
}

function MemberPaymentDialog({
  due,
  labels,
  member,
  onOpenChange,
  open,
}: {
  due: MemberDueRow | null;
  labels: MemberActionsLabels;
  member: MemberRow;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const activeSubscriptionId = due?.subscription_id ?? member.latest_subscription?.id ?? null;
  const [amount, setAmount] = React.useState(due?.balance ?? "");
  const [paymentMethod, setPaymentMethod] = React.useState<"cash" | "card" | "bank_transfer">("cash");
  const [extendDaysForOverpayment, setExtendDaysForOverpayment] = React.useState(false);
  const subscription = member.latest_subscription;
  const overpayment = Math.max(0, (Number(amount) || 0) - (Number(due?.balance) || 0));
  const periodDays = calculateMembershipDurationDays(subscription?.start_date, subscription?.end_date);
  const periodPrice = Number(subscription?.price_paid ?? 0);
  const extraDaysFromOverpayment =
    overpayment > 0 && periodPrice > 0 && periodDays && periodDays > 0
      ? Math.floor(overpayment / (periodPrice / periodDays))
      : 0;

  React.useEffect(() => {
    if (open) {
      setAmount(due?.balance ?? "");
      setPaymentMethod("cash");
      setExtendDaysForOverpayment(false);
    }
  }, [due?.balance, open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeSubscriptionId) {
      return;
    }

    startTransition(async () => {
      const result = await recordMembershipPayment({
        subscription_id: activeSubscriptionId,
        amount,
        method: paymentMethod,
        ...(extendDaysForOverpayment ? { extend_days_for_overpayment: true } : {}),
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{labels.addPayment}</DialogTitle>
          <DialogDescription>
            {labels.addPaymentDescription({
              balance: amount || due?.balance || "0",
            })}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{labels.member}</span>
              <span className="font-medium">{member.name}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{labels.subscription}</span>
              <span className="font-medium">#{activeSubscriptionId ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{labels.outstanding}</span>
              <span className="font-medium">{due?.balance ?? "0"}</span>
            </div>
          </div>
          <Field
            label={labels.paymentAmount}
            name="payment_amount"
            type="number"
            required
            value={amount}
            onChange={(event) => setAmount(event.currentTarget.value)}
          />
          <div className="grid gap-2">
            <Label htmlFor="member-payment-method">{labels.paymentMethod}</Label>
            <FormSelect
              id="member-payment-method"
              name="payment_method"
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod((value as "cash" | "card" | "bank_transfer") || "cash")}
              placeholder={labels.selectPaymentMethod}
              options={[
                { value: "cash", label: labels.cash },
                { value: "card", label: labels.card },
                { value: "bank_transfer", label: labels.bankTransfer },
              ]}
            />
          </div>
          {overpayment > 0 ? (
            <OverpaymentChoice
              checked={extendDaysForOverpayment}
              extraDays={extraDaysFromOverpayment}
              id="member-payment-extend"
              onCheckedChange={setExtendDaysForOverpayment}
              overpayment={overpayment}
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {labels.cancel}
            </Button>
            <Button type="submit" disabled={pending || !activeSubscriptionId}>
              {pending ? labels.working : labels.addPayment}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionFormContent({
  action,
  description,
  kind,
  member,
  onCancel,
  open,
  plans,
  staff = [],
  submitLabel,
  title,
}: {
  action: (state: MemberFormState, formData: FormData) => Promise<MemberFormState>;
  description: string;
  kind: "create" | "change";
  member: MemberRow;
  onCancel: () => void;
  open: boolean;
  plans: PlanRow[];
  staff?: StaffOption[];
  submitLabel: string;
  title: string;
}) {
  const t = useTranslations("Dashboard.membersPage");
  const router = useRouter();
  const studioPlanCategories = React.useMemo(() => new Set<string>(["fitness_studio", "jiu_jitsu"]), []);
  const isStudioPlanItem = React.useCallback(
    (plan: PlanRow) => plan.type === "fitness_studio" || studioPlanCategories.has(plan.category),
    [studioPlanCategories],
  );

  const sellablePlans = React.useMemo(() => plans.filter((plan) => plan.is_sellable), [plans]);
  const basePlans = React.useMemo(
    () => sellablePlans.filter((plan) => plan.type !== "extra_service" && !isStudioPlanItem(plan)),
    [isStudioPlanItem, sellablePlans],
  );
  const studioPlans = React.useMemo(
    () => sellablePlans.filter((plan) => isStudioPlanItem(plan)),
    [isStudioPlanItem, sellablePlans],
  );
  const servicePlans = React.useMemo(
    () => sellablePlans.filter((plan) => plan.type === "extra_service" && !isStudioPlanItem(plan)),
    [isStudioPlanItem, sellablePlans],
  );
  const currentSubscription = member.latest_subscription;
  const currentPlan = plans.find((plan) => {
    if (currentSubscription?.plan_id && plan.id === currentSubscription.plan_id) {
      return true;
    }

    return Boolean(currentSubscription?.plan_name && plan.name === currentSubscription.plan_name);
  });
  const currentPlanId = currentPlan ? String(currentPlan.id) : "";

  const [planCategoryTab, setPlanCategoryTab] = React.useState<"gym_access" | "fitness_studio">("gym_access");
  const availablePlans = React.useMemo(() => {
    let plansInTab = planCategoryTab === "fitness_studio" ? studioPlans : basePlans;

    if (plansInTab.length === 0) {
      plansInTab = sellablePlans;
    }

    if (kind === "change" && currentPlanId) {
      return plansInTab.filter((plan) => String(plan.id) !== currentPlanId);
    }

    return plansInTab;
  }, [basePlans, currentPlanId, kind, planCategoryTab, sellablePlans, studioPlans]);

  const initialPlan = availablePlans[0] ?? basePlans[0];
  // The gym's calendar, not the runtime's: this component is server-rendered
  // first, and a UTC server still reads yesterday until 03:00 in Cairo — which
  // would default the whole night shift's sales to the wrong start date.
  const defaultStartDate = React.useMemo(() => getGymTodayString(), []);
  const [state, submit, pending] = useActionState(action, initialMemberFormState);
  const [selectedPlanId, setSelectedPlanId] = React.useState(initialPlan ? String(initialPlan.id) : "");
  const [selectedCoachId, setSelectedCoachId] = React.useState<string>("");
  const [startDate, setStartDate] = React.useState(defaultStartDate);
  // `null` means "follow the plan duration". Staff can override the expiry for a
  // single member without touching the plan definition itself.
  const [endDateOverride, setEndDateOverride] = React.useState<string | null>(null);
  const [discountType, setDiscountType] = React.useState<"fixed" | "percent">("fixed");
  const [discountValue, setDiscountValue] = React.useState("0");
  const [paymentAmountOverride, setPaymentAmountOverride] = React.useState<string | null>(null);
  const [addons, setAddons] = React.useState<
    Array<{
      _key: string;
      coach_id: string;
      discountType: "fixed" | "percent";
      discountValue: string;
      payment_method: "cash" | "card" | "bank_transfer";
      plan_id: string;
    }>
  >([]);
  const [includedAddons, setIncludedAddons] = React.useState<Array<{ coach_id: string; plan_id: string }>>([]);
  const selectedPlan = plans.find((plan) => String(plan.id) === selectedPlanId) ?? availablePlans[0];
  const isStudioPlan = selectedPlan ? isStudioPlanItem(selectedPlan) : false;
  // A plan change picks its own dates too — staff sell the next period ahead of
  // time and the member starts on the agreed day, not the day they paid.
  const autoEndDate = selectedPlan && startDate ? calculatePlanEndDate(startDate, selectedPlan) : "";
  const endDate = endDateOverride ?? autoEndDate;
  const hasCustomEndDate = endDateOverride !== null && endDateOverride !== autoEndDate;
  const endDateBeforeStart = Boolean(endDate && startDate && endDate < startDate);
  const startsInFuture = Boolean(startDate && startDate > defaultStartDate);

  const normalizedDiscount = selectedPlan
    ? calculateDiscountAmount(selectedPlan.price, discountValue, discountType)
    : "0";
  let suggestedPaymentAmount = "";
  let priceDifference = 0;
  let oldPlanPrice = 0;

  if (selectedPlan) {
    if (kind === "change") {
      // A membership that has not started yet still credits what was paid for
      // it — otherwise switching an advance sale to another plan would charge
      // the member the full price a second time.
      oldPlanPrice =
        currentSubscription?.status === "active" || currentSubscription?.status === "scheduled"
          ? getMainPlanPaidTotal(currentSubscription, currentPlan)
          : 0;
      const discountedPlanPrice = Math.max(0, Number(selectedPlan.price) - Number(normalizedDiscount));
      priceDifference = discountedPlanPrice - oldPlanPrice;
      suggestedPaymentAmount = priceDifference.toFixed(2);
    } else {
      suggestedPaymentAmount = calculatePaymentAmount(selectedPlan.price, normalizedDiscount);
    }
  }
  const paymentAmount = paymentAmountOverride ?? (suggestedPaymentAmount !== "" ? suggestedPaymentAmount : "0.00");

  // What the member still owes after handing over `paymentAmount` today. Staff
  // take a deposit and collect the rest later, so the amount they type is not
  // required to cover the plan — only never to exceed it.
  const amountOwedNow = kind === "change" ? Math.max(0, priceDifference) : Number(suggestedPaymentAmount || "0");
  const paidNow = Number.parseFloat(paymentAmount);
  const hasValidPaidNow = !Number.isNaN(paidNow) && paidNow >= 0;
  const balanceDue = hasValidPaidNow ? Math.max(0, amountOwedNow - paidNow) : 0;
  const paymentExceedsPrice = hasValidPaidNow && paidNow > amountOwedNow;
  const paymentIsPartial = hasValidPaidNow && balanceDue > 0;

  /**
   * Why submit is blocked, or null when it is fine.
   *
   * A disabled button with nothing next to it left staff guessing — the common
   * case is a stopped membership, which cannot be upgraded (the API rejects it
   * too) and needs renewing instead.
   */
  const submitBlockedReason = React.useMemo(() => {
    // Guarding on basePlans blocked studio-only selections even when a studio
    // plan was picked; what matters is whether anything is sellable at all.
    if (sellablePlans.length === 0) {
      return t("changePlanBlockedNoPlans");
    }

    if (endDateBeforeStart) {
      return t("endDateBeforeStart");
    }

    // The amount is free text now that staff can part-pay, and anything over
    // the price silently extends the membership on the API side.
    if (kind === "create" && paymentExceedsPrice) {
      return t("paymentAbovePrice");
    }

    if (kind === "create" && !hasValidPaidNow) {
      return t("paymentAmountInvalid");
    }

    if (kind === "change" && currentSubscription?.status !== "active" && currentSubscription?.status !== "scheduled") {
      return t("changePlanBlockedNotActive", { status: currentSubscription?.status ?? "-" });
    }

    if (kind === "change" && !selectedPlanId) {
      return t("changePlanBlockedNoPlanSelected");
    }

    return null;
  }, [
    currentSubscription?.status,
    endDateBeforeStart,
    hasValidPaidNow,
    kind,
    paymentExceedsPrice,
    selectedPlanId,
    sellablePlans.length,
    t,
  ]);

  React.useEffect(() => {
    if (selectedPlan) {
      const defaultCoach = getDefaultCoachIdForPlan(selectedPlan, plans, staff);
      setSelectedCoachId(defaultCoach);
    }
  }, [plans, selectedPlan, staff]);

  React.useEffect(() => {
    if (kind !== "create") return;
    setIncludedAddons(
      (selectedPlan?.package_addons ?? []).map((item) => ({
        coach_id: String(item.coach_id),
        plan_id: String(item.plan_id),
      })),
    );
  }, [kind, selectedPlan?.package_addons]);

  React.useEffect(() => {
    if (!state.ok) {
      return;
    }

    toast.success(state.message ?? submitLabel);
    onCancel();
    router.refresh();
  }, [onCancel, router, state.message, state.ok, submitLabel]);

  const wasOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      let defaultTab: "gym_access" | "fitness_studio" = "gym_access";
      if (currentPlan && isStudioPlanItem(currentPlan)) {
        defaultTab = "fitness_studio";
      }

      setPlanCategoryTab(defaultTab);

      let targetPlans = basePlans.length > 0 ? basePlans : sellablePlans;
      if (defaultTab === "fitness_studio") {
        targetPlans = studioPlans.length > 0 ? studioPlans : sellablePlans;
      }

      const selectablePlans =
        kind === "change" && currentPlanId
          ? targetPlans.filter((plan) => String(plan.id) !== currentPlanId)
          : targetPlans;
      setSelectedPlanId(selectablePlans[0] ? String(selectablePlans[0].id) : "");

      setStartDate(defaultStartDate);
      setEndDateOverride(null);
      setDiscountType("fixed");
      setDiscountValue("0");
      setPaymentAmountOverride(null);

      if (kind === "change" && currentSubscription?.addons && currentSubscription.addons.length > 0) {
        const initialAddons = currentSubscription.addons
          .filter((a) => a.status !== "stopped" && a.status !== "cancelled")
          .map((addon, index) => {
            const matchingPlan = plans.find(
              (p) =>
                (addon.plan?.id && p.id === addon.plan.id) ||
                (addon.plan?.name && p.name.toLowerCase() === addon.plan.name.toLowerCase()),
            );
            let planId = "";
            if (matchingPlan) {
              planId = String(matchingPlan.id);
            } else if (addon.plan?.id) {
              planId = String(addon.plan.id);
            }
            const coachId = addon.coach?.id ? String(addon.coach.id) : "";

            return {
              _key: `addon-${addon.id || index}-${index}`,
              plan_id: planId,
              coach_id: coachId,
              discountType: "fixed" as const,
              discountValue: "0",
              payment_method: "cash" as const,
            };
          })
          .filter((item) => item.plan_id !== "");

        setAddons(initialAddons);
      } else {
        setAddons([]);
      }
    }
    wasOpenRef.current = open;
  }, [
    basePlans,
    currentPlan,
    currentPlanId,
    currentSubscription,
    defaultStartDate,
    isStudioPlanItem,
    kind,
    open,
    plans,
    sellablePlans,
    studioPlans,
  ]);

  return (
    // This form is long enough to outgrow a laptop viewport on its own, so the
    // body scrolls inside the dialog and the footer stays put — otherwise the
    // submit button sits below the fold behind "Add extra service".
    <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form action={submit} className="flex min-h-0 flex-1 flex-col gap-4">
        <input type="hidden" name="member_id" value={member.id} />
        {kind === "change" ? (
          <input
            type="hidden"
            name="subscription_id"
            value={currentSubscription ? String(currentSubscription.id) : ""}
          />
        ) : null}
        <input
          type="hidden"
          name="addons"
          value={JSON.stringify(
            addons
              .map((addon) => {
                const addonPlan = servicePlans.find((plan) => String(plan.id) === addon.plan_id);

                if (!addonPlan) {
                  return null;
                }

                return {
                  coach_id: addon.coach_id ? Number(addon.coach_id) : null,
                  discount: calculateDiscountAmount(addonPlan.price, addon.discountValue, addon.discountType),
                  payment_amount: calculatePaymentAmount(
                    addonPlan.price,
                    calculateDiscountAmount(addonPlan.price, addon.discountValue, addon.discountType),
                  ),
                  payment_method: addon.payment_method,
                  plan_id: Number(addon.plan_id),
                };
              })
              .filter(Boolean),
          )}
        />
        <input
          type="hidden"
          name="included_addons"
          value={JSON.stringify(
            includedAddons.map((item) => ({
              coach_id: Number(item.coach_id),
              plan_id: Number(item.plan_id),
            })),
          )}
        />
        {/* Negative margin + padding so focus rings are not clipped by the
            scroll container's edge. */}
        <div className="-mx-4 grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4">
          {state.message ? (
            <div
              className={
                state.ok
                  ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-600 text-sm"
                  : "rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
              }
            >
              {state.message}
            </div>
          ) : null}
          {kind === "change" && currentSubscription ? <CurrentMembershipSummary member={member} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/20 p-1 text-xs sm:col-span-2 sm:text-sm">
              <button
                type="button"
                onClick={() => {
                  setPlanCategoryTab("gym_access");
                  const gymPlans =
                    kind === "change" ? basePlans.filter((plan) => String(plan.id) !== currentPlanId) : basePlans;
                  setSelectedPlanId(gymPlans[0] ? String(gymPlans[0].id) : "");
                  setEndDateOverride(null);
                  setPaymentAmountOverride(null);
                }}
                className={
                  planCategoryTab === "gym_access"
                    ? "rounded-md bg-background px-2 py-1.5 font-medium text-foreground shadow-sm sm:px-3 sm:py-2"
                    : "rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground sm:px-3 sm:py-2"
                }
              >
                Main plans
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlanCategoryTab("fitness_studio");
                  const studioPlansForChange =
                    kind === "change" ? studioPlans.filter((plan) => String(plan.id) !== currentPlanId) : studioPlans;
                  setSelectedPlanId(studioPlansForChange[0] ? String(studioPlansForChange[0].id) : "");
                  setEndDateOverride(null);
                  setPaymentAmountOverride(null);
                }}
                className={
                  planCategoryTab === "fitness_studio"
                    ? "rounded-md bg-background px-2 py-1.5 font-medium text-foreground shadow-sm sm:px-3 sm:py-2"
                    : "rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground sm:px-3 sm:py-2"
                }
              >
                Fitness studio plans
              </button>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="plan_id">{kind === "create" ? t("plan") : t("newPlan")}</Label>
              <FormSelect
                id="plan_id"
                name="plan_id"
                value={selectedPlanId}
                onValueChange={(value) => {
                  setSelectedPlanId(value);
                  setEndDateOverride(null);
                  setPaymentAmountOverride(null);
                }}
                required
                placeholder={t("selectPlan")}
                error={fieldError(state, "plan_id")}
                options={availablePlans.map((plan) => ({
                  value: String(plan.id),
                  label: `${plan.name} - ${plan.price} EGP`,
                }))}
              />
            </div>
            {isStudioPlan ? (
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="coach_id">Assign Studio Coach</Label>
                <FormSelect
                  id="coach_id"
                  name="coach_id"
                  value={selectedCoachId}
                  onValueChange={setSelectedCoachId}
                  placeholder="Select a coach for this studio plan"
                  options={getPlanCoachOptions(selectedPlan, plans, staff).map((employee) => ({
                    value: String(employee.id),
                    label: employee.role ? `${employee.name} - ${employee.role}` : employee.name,
                  }))}
                />
                <p className="text-muted-foreground text-xs">
                  The assigned coach will receive coach commission for selling / coaching this studio membership.
                </p>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="start_date">{t("startDate")}</Label>
              <FormDatePicker
                key={`${member.id}-${kind}-${open ? "open" : "closed"}-${startDate}`}
                id="start_date"
                name="start_date"
                defaultValue={startDate}
                placeholder={t("selectDate")}
                required
                error={fieldError(state, "start_date")}
                onValueChange={setStartDate}
              />
              {startsInFuture ? (
                <p className="text-muted-foreground text-xs">
                  {kind === "change" ? t("startDateFutureChangeHint") : t("startDateFutureHint")}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="end_date">{t("endDate")}</Label>
                {hasCustomEndDate ? (
                  <button
                    type="button"
                    className="text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
                    onClick={() => setEndDateOverride(null)}
                  >
                    {t("endDateReset")}
                  </button>
                ) : null}
              </div>
              <FormDatePicker
                id="end_date"
                name="end_date"
                value={endDate}
                placeholder={t("selectDate")}
                error={fieldError(state, "end_date") ?? (endDateBeforeStart ? t("endDateBeforeStart") : undefined)}
                onValueChange={(value) => setEndDateOverride(value === autoEndDate ? null : value)}
              />
              <p className="text-muted-foreground text-xs">
                {hasCustomEndDate ? t("endDateCustomHint", { date: autoEndDate }) : t("endDateAutoHint")}
              </p>
            </div>
            {kind === "change" ? (
              <div className="grid gap-2 sm:col-span-2">
                <input type="hidden" name="credit_mode" value="full_difference" />
                {selectedPlan && currentSubscription ? (
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm">
                    <div className="flex items-center justify-between font-semibold text-blue-700 dark:text-blue-400">
                      <span>Price difference (Suggested)</span>
                      <span className="font-bold text-base">
                        {priceDifference >= 0
                          ? `+${priceDifference.toFixed(2)} EGP`
                          : `${priceDifference.toFixed(2)} EGP`}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-muted-foreground text-xs">
                      <div>
                        <span>Current plan: </span>
                        <strong className="text-foreground">
                          {currentSubscription.plan_name ?? currentPlan?.name ?? "Current"} ({oldPlanPrice.toFixed(2)}{" "}
                          EGP)
                        </strong>
                      </div>
                      <div>
                        <span>New plan: </span>
                        <strong className="text-foreground">
                          {selectedPlan.name} ({Number(selectedPlan.price).toFixed(2)} EGP)
                        </strong>
                        {Number(normalizedDiscount) > 0 ? (
                          <span className="block">
                            After discount: {(Number(selectedPlan.price) - Number(normalizedDiscount)).toFixed(2)} EGP
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="payment_amount">
                  {kind === "change" ? t("paymentAmount") : t("paymentAmountPaidNow")}
                </Label>
                {kind === "create" && paymentAmountOverride !== null ? (
                  <button
                    type="button"
                    className="text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
                    onClick={() => setPaymentAmountOverride(null)}
                  >
                    {t("paymentAmountReset")}
                  </button>
                ) : null}
              </div>
              <input type="hidden" name="amount_due" value={paymentAmount} />
              <Input
                id="payment_amount"
                name="payment_amount"
                type="text"
                inputMode="decimal"
                required
                value={paymentAmount}
                onChange={(event) => setPaymentAmountOverride(event.currentTarget.value)}
                aria-invalid={Boolean(fieldError(state, "payment_amount")) || paymentExceedsPrice}
              />
              {kind === "change" ? (
                <p className="text-muted-foreground text-xs">
                  Enter price difference (+ for extra payment, - for refund).
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">{t("paymentAmountPartialHint")}</p>
              )}
              <FieldError errors={state.errors.payment_amount} />
            </div>
            {kind === "create" && selectedPlan ? (
              <div className="grid gap-2 sm:col-span-2">
                <div
                  className={cn(
                    "rounded-lg border p-3 text-sm",
                    paymentExceedsPrice ? "border-destructive/40 bg-destructive/10" : "border-border bg-muted/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t("totalDue")}</span>
                    <span className="font-medium tabular-nums">{amountOwedNow.toFixed(2)} EGP</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t("paidNow")}</span>
                    <span className="font-medium tabular-nums">{hasValidPaidNow ? paidNow.toFixed(2) : "—"} EGP</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 border-t pt-2">
                    <span className="font-semibold">{t("balanceDue")}</span>
                    <span
                      className={cn(
                        "font-bold text-base tabular-nums",
                        paymentIsPartial ? "text-amber-600 dark:text-amber-400" : "",
                      )}
                    >
                      {balanceDue.toFixed(2)} EGP
                    </span>
                  </div>
                  {paymentExceedsPrice ? (
                    <p className="mt-2 text-destructive text-xs">{t("paymentAbovePrice")}</p>
                  ) : null}
                  {paymentIsPartial ? (
                    <p className="mt-2 text-muted-foreground text-xs">{t("balanceDueHint")}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="payment_method">{t("paymentMethod")}</Label>
              <FormSelect
                id="payment_method"
                name="payment_method"
                defaultValue="cash"
                error={fieldError(state, "payment_method")}
                options={[
                  { value: "cash", label: t("cash") },
                  { value: "card", label: t("card") },
                  { value: "bank_transfer", label: t("bankTransfer") },
                ]}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="discount_value">{t("discount")}</Label>
              <input type="hidden" name="discount" value={normalizedDiscount} />
              <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <FormSelect
                  id="discount_type"
                  name="discount_type"
                  value={discountType}
                  onValueChange={(value) => setDiscountType((value as "fixed" | "percent") || "fixed")}
                  options={[
                    { value: "fixed", label: t("fixedAmount") },
                    { value: "percent", label: t("percent") },
                  ]}
                />
                <div className="relative">
                  <Input
                    id="discount_value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountValue}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;

                      setDiscountValue(nextValue);
                    }}
                    aria-invalid={Boolean(fieldError(state, "discount"))}
                    className="pe-14"
                  />
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {discountType === "fixed" ? "EGP" : "%"}
                  </span>
                </div>
              </div>
              <FieldError errors={state.errors.discount} />
            </div>
          </div>
          <div className="grid gap-3 rounded-lg border border-dashed p-4">
            {includedAddons.length > 0 ? (
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
                <div>
                  <Label>Included extra services</Label>
                  <p className="text-muted-foreground text-xs">
                    Included in the selected plan price. Choose the captain for each service.
                  </p>
                </div>
                {includedAddons.map((included, index) => {
                  const includedPlan = servicePlans.find((plan) => String(plan.id) === included.plan_id);
                  const coachOptions = getPlanCoachOptions(includedPlan, plans, staff).map((employee) => ({
                    value: String(employee.id),
                    label: employee.role ? `${employee.name} - ${employee.role}` : employee.name,
                  }));
                  return (
                    <div className="grid gap-2 sm:grid-cols-2" key={included.plan_id}>
                      <Input readOnly value={includedPlan?.name ?? "Included extra service"} />
                      <FormSelect
                        name={`included_addons[${index}][coach_id]`}
                        value={included.coach_id}
                        onValueChange={(value) =>
                          setIncludedAddons((items) =>
                            items.map((item, itemIndex) => (itemIndex === index ? { ...item, coach_id: value } : item)),
                          )
                        }
                        options={coachOptions}
                        placeholder="Select captain"
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className="space-y-1">
              <Label>{t("addSubscriptionExtra")}</Label>
              <p className="text-muted-foreground text-xs">{t("addSubscriptionExtraDescription")}</p>
              <p className="text-muted-foreground text-xs">{t("addSubscriptionExtraNote")}</p>
            </div>
            {addons.map((addon, index) => {
              const addonPlan = servicePlans.find((plan) => String(plan.id) === addon.plan_id) ?? servicePlans[0];
              const coachOptions = getPlanCoachOptions(addonPlan, plans, staff).map((employee) => ({
                value: String(employee.id),
                label: employee.role ? `${employee.name} - ${employee.role}` : employee.name,
              }));
              const addonDiscount = addonPlan
                ? calculateDiscountAmount(addonPlan.price, addon.discountValue, addon.discountType)
                : "0";
              const addonPayment = addonPlan ? calculatePaymentAmount(addonPlan.price, addonDiscount) : "0";
              const coachCommission = calculateAddonCoachCommissionPreview({
                addonPayment,
                basePayment: paymentAmount,
                coachId: addon.coach_id || coachOptions[0]?.value || "",
                plan: addonPlan,
              });

              return (
                <div key={addon._key} className="grid gap-3 rounded-lg border p-3 lg:grid-cols-2">
                  <div className="grid gap-2 lg:col-span-2">
                    <Label>{t("extraService")}</Label>
                    <FormSelect
                      name={`addons.${index}.plan_id`}
                      value={addon.plan_id}
                      onValueChange={(value) =>
                        setAddons((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  coach_id: getDefaultCoachIdForPlan(
                                    servicePlans.find((plan) => String(plan.id) === value),
                                    plans,
                                    staff,
                                  ),
                                  plan_id: value ?? "",
                                }
                              : item,
                          ),
                        )
                      }
                      contentClassName="w-[28rem] max-w-[calc(100vw-2rem)]"
                      options={servicePlans.map((plan) => ({
                        value: String(plan.id),
                        label: `${plan.name} - ${plan.price} EGP`,
                      }))}
                    />
                  </div>
                  <div className="grid gap-2 lg:col-span-2">
                    <Label>{t("coach")}</Label>
                    <FormSelect
                      name={`addons.${index}.coach_id`}
                      value={addon.coach_id || coachOptions[0]?.value || ""}
                      onValueChange={(value) =>
                        setAddons((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, coach_id: value ?? "" } : item,
                          ),
                        )
                      }
                      contentClassName="w-[24rem] max-w-[calc(100vw-2rem)]"
                      options={coachOptions}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("discount")}</Label>
                    <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                      <FormSelect
                        name={`addons.${index}.discount_type`}
                        value={addon.discountType}
                        onValueChange={(value) =>
                          setAddons((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, discountType: (value as "fixed" | "percent") ?? "fixed" }
                                : item,
                            ),
                          )
                        }
                        options={[
                          { value: "fixed", label: t("fixedAmount") },
                          { value: "percent", label: t("percent") },
                        ]}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={addon.discountValue}
                        onChange={(event) => {
                          const nextValue = event.currentTarget.value;

                          setAddons((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, discountValue: nextValue } : item,
                            ),
                          );
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("paymentMethod")}</Label>
                    <FormSelect
                      name={`addons.${index}.payment_method`}
                      value={addon.payment_method}
                      onValueChange={(value) =>
                        setAddons((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, payment_method: (value as "cash" | "card" | "bank_transfer") || "cash" }
                              : item,
                          ),
                        )
                      }
                      options={[
                        { value: "cash", label: t("cash") },
                        { value: "card", label: t("card") },
                        { value: "bank_transfer", label: t("bankTransfer") },
                      ]}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("addonCharge")}</Label>
                    <Input value={addonPayment} readOnly />
                    <p className="text-muted-foreground text-xs">{t("addonChargeHelp")}</p>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("addonCoachCommission")}</Label>
                    <Input value={coachCommission.amount} readOnly />
                    <p className="text-muted-foreground text-xs">
                      {coachCommission.isPercentage
                        ? t("addonCoachCommissionPercentHelp")
                        : t("addonCoachCommissionFixedHelp")}
                    </p>
                  </div>
                  <div className="flex items-end lg:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setAddons((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      {t("delete")}
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                setAddons((current) => [
                  ...current,
                  {
                    _key: `addon-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`,
                    coach_id: getDefaultCoachIdForPlan(servicePlans[0], plans, staff),
                    discountType: "fixed",
                    discountValue: "0",
                    payment_method: "cash",
                    plan_id: servicePlans[0] ? String(servicePlans[0].id) : "",
                  },
                ])
              }
              disabled={servicePlans.length === 0}
            >
              {t("addSubscriptionExtra")}
            </Button>
          </div>
        </div>
        {submitBlockedReason ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 text-xs dark:text-amber-300">
            {submitBlockedReason}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={pending || submitBlockedReason !== null}>
            {pending ? t("saving") : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function isCoachEmployee(role?: string | null): boolean {
  if (!role) {
    return false;
  }
  const r = role.toLowerCase();
  return r.includes("coach") || r.includes("captain") || r.includes("trainer") || r.includes("pt");
}

function getPlanCoachOptions(
  plan: PlanRow | undefined,
  allPlans?: PlanRow[],
  staff?: StaffOption[],
): PlanAssignedEmployee[] {
  const planCoaches = getAssignedEmployees(plan);
  if (planCoaches.length > 0) {
    return planCoaches;
  }

  const assigned = new Map<number, PlanAssignedEmployee>();

  if (allPlans) {
    for (const p of allPlans) {
      for (const coach of getAssignedEmployees(p)) {
        if (!assigned.has(coach.id)) {
          assigned.set(coach.id, coach);
        }
      }
    }
  }

  if (staff) {
    for (const member of staff) {
      if (!assigned.has(member.id) && isCoachEmployee(member.role)) {
        assigned.set(member.id, {
          id: member.id,
          name: member.name,
          role: member.role ?? null,
        });
      }
    }
  }

  return Array.from(assigned.values());
}

function getDefaultCoachIdForPlan(plan: PlanRow | undefined, allPlans?: PlanRow[], staff?: StaffOption[]): string {
  const [firstCoach] = getPlanCoachOptions(plan, allPlans, staff);

  return firstCoach ? String(firstCoach.id) : "";
}

function getAssignedEmployees(plan?: PlanRow | null): PlanAssignedEmployee[] {
  if (!plan?.employee_commission_rules?.length) {
    return [];
  }

  const assigned = new Map<number, PlanAssignedEmployee>();

  for (const rule of plan.employee_commission_rules) {
    if (!rule.is_active || !rule.employee) {
      continue;
    }

    assigned.set(rule.employee.id, rule.employee);
  }

  return Array.from(assigned.values());
}

function calculateAddonCoachCommissionPreview({
  addonPayment,
  basePayment,
  coachId,
  plan,
}: {
  addonPayment: string;
  basePayment: string;
  coachId: string;
  plan?: PlanRow;
}) {
  const coachIdNumber = Number(coachId);
  const rule = plan?.employee_commission_rules?.find((item) => item.is_active && item.employee_id === coachIdNumber);

  if (!rule) {
    return {
      amount: "0.00",
      isPercentage: true,
    };
  }

  if (rule.calculation_type === "fixed") {
    return {
      amount: Math.max(0, Number(rule.value || 0)).toFixed(2),
      isPercentage: false,
    };
  }

  const totalPaid = Math.max(0, Number(basePayment || 0)) + Math.max(0, Number(addonPayment || 0));
  const commission = totalPaid * (Math.min(Math.max(0, Number(rule.value || 0)), 100) / 100);

  return {
    amount: Number.isFinite(commission) ? commission.toFixed(2) : "0.00",
    isPercentage: true,
  };
}

function PhotoDialogContent({
  member,
  onCancel,
  pending,
  previewUrl,
  setPreviewUrl,
  submit,
}: {
  member: MemberRow;
  onCancel: () => void;
  pending: boolean;
  previewUrl: string | null;
  setPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
  submit: (formData: FormData) => void;
}) {
  const t = useTranslations("Dashboard.membersPage");

  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return file ? URL.createObjectURL(file) : null;
    });
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{t("uploadPhoto")}</DialogTitle>
        <DialogDescription>{t("uploadPhotoDescription", { name: member.name })}</DialogDescription>
      </DialogHeader>
      <form action={submit} className="grid gap-4">
        <input type="hidden" name="member_id" value={member.id} />
        <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
            {previewUrl ? (
              <Image src={previewUrl} alt="" width={96} height={96} unoptimized className="size-full object-cover" />
            ) : (
              <ImageUp className="size-8 text-muted-foreground" />
            )}
          </div>
          <div className="grid min-w-0 flex-1 gap-2">
            <Input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={handleFileChange}
            />
            <p className="text-muted-foreground text-xs">{t("photoHelp")}</p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? t("uploading") : t("uploadPhoto")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function DeactivateMemberItem({ member }: { member: MemberRow }) {
  const t = useTranslations("Dashboard.membersPage");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const isActive = member.status === "active";

  return (
    <DropdownMenuItem
      variant={isActive ? "destructive" : "default"}
      disabled={pending}
      onClick={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("id", String(member.id));
        formData.set("name", member.name);
        formData.set("phone", member.phone);
        startTransition(async () => {
          try {
            if (isActive) {
              await deactivateMember(formData);
              toast.success(t("memberDeactivated"));
            } else {
              await reactivateMember(formData);
              toast.success("Member reactivated successfully.");
            }
            router.refresh();
          } catch (error) {
            toast.error(isActive ? t("deactivateFailed") : "Reactivation failed.", {
              description: error instanceof Error ? error.message : t("pleaseTryAgain"),
            });
          }
        });
      }}
    >
      {isActive ? t("deactivate") : "Reactivate member"}
    </DropdownMenuItem>
  );
}

function CurrentMembershipSummary({ member }: { member: MemberRow }) {
  const subscription = member.latest_subscription;

  if (!subscription) {
    return null;
  }

  const startedOn = parseDateOnly(subscription.start_date ?? "");
  const daysInPlan = startedOn ? Math.max(0, Math.floor((Date.now() - startedOn.getTime()) / 86_400_000)) : null;
  const sessionsUsed =
    subscription.sessions_total !== null &&
    subscription.sessions_total !== undefined &&
    subscription.sessions_remaining !== null &&
    subscription.sessions_remaining !== undefined
      ? Math.max(0, subscription.sessions_total - subscription.sessions_remaining)
      : null;
  const activeAddons = (subscription.addons ?? []).filter(
    (addon) => addon.status !== "stopped" && addon.status !== "cancelled",
  );
  const amountPaid = Number(subscription.paid_total ?? subscription.price_paid ?? 0);

  return (
    <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-xs sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="font-semibold text-foreground">Current membership</p>
        <p className="text-muted-foreground">
          {subscription.plan_name ?? "Current plan"} · {amountPaid.toFixed(2)} EGP paid
        </p>
      </div>
      <SummaryItem label="Purchased" value={subscription.start_date ?? "—"} />
      <SummaryItem label="Ends" value={subscription.projected_end_date ?? subscription.end_date ?? "—"} />
      <SummaryItem label="Time in plan" value={daysInPlan === null ? "—" : `${daysInPlan} day(s)`} />
      <SummaryItem label="Gym visits this month" value={`${member.visits_this_month ?? 0}`} />
      <SummaryItem
        label="Plan sessions"
        value={
          sessionsUsed === null
            ? "Unlimited / not session-based"
            : `${sessionsUsed} attended · ${subscription.sessions_remaining}/${subscription.sessions_total} remaining`
        }
      />
      <SummaryItem
        label="Active extras"
        value={activeAddons.length > 0 ? activeAddons.map((addon) => addon.plan?.name ?? "Extra").join(", ") : "None"}
      />
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function calculatePlanEndDate(startDate: string, plan: PlanRow) {
  const parsedStart = parseDateOnly(startDate);

  if (!parsedStart) {
    return "";
  }

  const endDate =
    plan.duration_months && plan.duration_months > 0
      ? addMonthsNoOverflow(parsedStart, plan.duration_months)
      : addDays(parsedStart, Math.max(1, plan.duration_days));

  return formatDateOnly(endDate);
}

function calculatePaymentAmount(price: string, discount: string) {
  const amount = Math.max(0, Number(price || 0) - Number(discount || 0));

  return Number.isFinite(amount) ? amount.toFixed(2) : "";
}

function getMainPlanPaidTotal(
  subscription?: {
    status?: string | null;
    paid_total?: string | number | null;
    price_paid?: string | number | null;
    addons?: Array<{
      price_paid?: string | number | null;
      plan?: { id?: number; name?: string | null; price?: string | number | null } | null;
    }>;
  } | null,
  currentPlan?: PlanRow | null,
): number {
  if (
    !subscription ||
    subscription.status === "stopped" ||
    subscription.status === "cancelled" ||
    subscription.status === "inactive"
  ) {
    return 0;
  }

  // An upgrade credits what the member actually paid for the previous plan.
  // The current catalog price can change after a subscription is sold, so it
  // is only a last-resort fallback when historical payment data is unavailable.
  if (subscription.paid_total !== undefined && subscription.paid_total !== null) {
    const paidTotal = Number(subscription.paid_total);
    return Number.isFinite(paidTotal) ? Math.max(0, paidTotal) : 0;
  }

  if (subscription.price_paid !== undefined && subscription.price_paid !== null) {
    const pricePaid = Number(subscription.price_paid);
    return Number.isFinite(pricePaid) ? Math.max(0, pricePaid) : 0;
  }

  const catalogPrice = Number(currentPlan?.price ?? 0);
  return Number.isFinite(catalogPrice) ? Math.max(0, catalogPrice) : 0;
}

function calculateDiscountAmount(price: string, discountValue: string, discountType: "fixed" | "percent") {
  const normalizedPrice = Number(price || 0);
  const normalizedDiscount = Math.max(0, Number(discountValue || 0));

  if (!Number.isFinite(normalizedPrice) || !Number.isFinite(normalizedDiscount)) {
    return "0";
  }

  if (discountType === "percent") {
    const amount = normalizedPrice * (Math.min(normalizedDiscount, 100) / 100);

    return amount.toFixed(2);
  }

  return normalizedDiscount.toFixed(2);
}

function parseDateOnly(value: string) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);

  return next;
}

function calculateMembershipDurationDays(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) {
    return null;
  }

  const start = startDate.split("-").map(Number);
  const end = endDate.split("-").map(Number);

  if (start.length !== 3 || end.length !== 3 || start.some(Number.isNaN) || end.some(Number.isNaN)) {
    return null;
  }

  const startUtc = Date.UTC(start[0], start[1] - 1, start[2]);
  const endUtc = Date.UTC(end[0], end[1] - 1, end[2]);

  return Math.round((endUtc - startUtc) / 86_400_000);
}

function parseNonNegativeInteger(value: string) {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function addMonthsNoOverflow(date: Date, months: number) {
  const targetMonth = date.getMonth() + months;
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  const next = new Date(date);

  next.setDate(1);
  next.setMonth(targetMonth);
  next.setDate(Math.min(date.getDate(), lastDay));

  return next;
}

function MemberFormContent({
  action,
  description,
  member,
  submitLabel,
  title,
  onSuccess,
}: {
  action: (state: MemberFormState, formData: FormData) => Promise<MemberFormState>;
  description: string;
  member?: MemberRow;
  submitLabel: string;
  title: string;
  onSuccess?: () => void;
}) {
  const t = useTranslations("Dashboard.membersPage");
  const router = useRouter();
  const [state, submit, pending] = useActionState(action, initialMemberFormState);
  const [values, setValues] = React.useState<MemberFormValues>(() => getMemberFormValues(member));

  React.useEffect(() => {
    if (!state.ok) {
      return;
    }

    toast.success(state.message ?? submitLabel);
    onSuccess?.();
    router.refresh();
  }, [onSuccess, router, state.message, state.ok, submitLabel]);

  React.useEffect(() => {
    if (state.ok) {
      if (!member) {
        setValues(getMemberFormValues());
      }

      return;
    }

    if (Object.keys(state.values).length > 0) {
      setValues(mergeMemberFormValues(member, state.values));
      return;
    }

    setValues(getMemberFormValues(member));
  }, [member, state.ok, state.values]);

  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form action={submit} className="grid gap-4">
        {member ? <input type="hidden" name="id" value={member.id} /> : null}
        {state.message ? (
          <div
            className={
              state.ok
                ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-600 text-sm"
                : "rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
            }
          >
            {state.message}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            error={fieldError(state, "name")}
            label={t("nameField")}
            name="name"
            value={values.name}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;

              setValues((current) => ({ ...current, name: nextValue }));
            }}
            required
          />
          <Field
            error={fieldError(state, "phone")}
            label={t("phone")}
            name="phone"
            value={values.phone}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;

              setValues((current) => ({ ...current, phone: nextValue }));
            }}
            required
          />
          <Field
            error={fieldError(state, "email")}
            label={`${t("email")} (${t("optionalField")})`}
            name="email"
            type="email"
            value={values.email}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;

              setValues((current) => ({ ...current, email: nextValue }));
            }}
          />
          <div className="grid gap-2">
            <Label htmlFor="member-gender">{`${t("gender")} (${t("optionalField")})`}</Label>
            <FormSelect
              id="member-gender"
              name="gender"
              value={values.gender}
              onValueChange={(value) => setValues((current) => ({ ...current, gender: value }))}
              placeholder={t("selectGender")}
              error={fieldError(state, "gender")}
              options={[
                { value: "male", label: t("male") },
                { value: "female", label: t("female") },
              ]}
            />
          </div>
          <DateField
            error={fieldError(state, "join_date")}
            label={`${t("joinDate")} (${t("optionalField")})`}
            name="join_date"
            value={values.join_date}
            onValueChange={(value) => setValues((current) => ({ ...current, join_date: value }))}
          />
          <DateField
            error={fieldError(state, "birth_date")}
            label={`${t("birthDate")} (${t("optionalField")})`}
            name="birth_date"
            value={values.birth_date}
            onValueChange={(value) => setValues((current) => ({ ...current, birth_date: value }))}
          />
          <Field
            error={fieldError(state, "national_id")}
            label={`${t("nationalId")} (${t("optionalField")})`}
            name="national_id"
            value={values.national_id}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;

              setValues((current) => ({ ...current, national_id: nextValue }));
            }}
          />
          <div className="grid gap-2">
            <Label htmlFor="member-status">{t("status")}</Label>
            <FormSelect
              id="member-status"
              name="status"
              value={values.status}
              onValueChange={(value) => setValues((current) => ({ ...current, status: value || "active" }))}
              placeholder={t("selectStatus")}
              error={fieldError(state, "status")}
              options={[
                { value: "active", label: t("active") },
                { value: "inactive", label: t("inactive") },
              ]}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="member-notes">{`${t("notes")} (${t("optionalField")})`}</Label>
          <Textarea
            id="member-notes"
            name="notes"
            value={values.notes}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;

              setValues((current) => ({ ...current, notes: nextValue }));
            }}
          />
          <FieldError errors={state.errors.notes} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? t("saving") : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function fieldError(state: MemberFormState, name: string) {
  return state.errors[name]?.[0];
}

function getMemberFormValues(member?: MemberRow): MemberFormValues {
  return {
    birth_date: member?.birth_date ?? "",
    email: member?.email ?? "",
    gender: member?.gender ?? "",
    join_date: member?.join_date ?? "",
    name: member?.name ?? "",
    national_id: member?.national_id ?? "",
    notes: member?.notes ?? "",
    phone: member?.phone ?? "",
    status: member?.status ?? "active",
  };
}

function mergeMemberFormValues(member: MemberRow | undefined, values: Record<string, string>): MemberFormValues {
  const base = getMemberFormValues(member);

  return {
    birth_date: "birth_date" in values ? values.birth_date : base.birth_date,
    email: "email" in values ? values.email : base.email,
    gender: "gender" in values ? values.gender : base.gender,
    join_date: "join_date" in values ? values.join_date : base.join_date,
    name: "name" in values ? values.name : base.name,
    national_id: "national_id" in values ? values.national_id : base.national_id,
    notes: "notes" in values ? values.notes : base.notes,
    phone: "phone" in values ? values.phone : base.phone,
    status: "status" in values ? values.status : base.status,
  };
}

/**
 * Money over the price is money. It only becomes time if the desk says so here,
 * which is why the box starts unticked and states the days it would add.
 */
function OverpaymentChoice({
  checked,
  extraDays,
  id,
  onCheckedChange,
  overpayment,
}: {
  checked: boolean;
  extraDays: number;
  id: string;
  onCheckedChange: (checked: boolean) => void;
  overpayment: number;
}) {
  const t = useTranslations("Dashboard.membersPage");

  return (
    <div className="grid gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3">
      <p className="font-medium text-amber-700 text-sm dark:text-amber-300">
        {t("overpaymentNotice", { amount: formatCurrency(overpayment, { currency: "EGP" }) })}
      </p>
      <div className="flex items-start gap-2">
        <Checkbox id={id} checked={checked} onCheckedChange={(next) => onCheckedChange(next === true)} />
        <div className="grid gap-1">
          <Label htmlFor={id}>{t("overpaymentBuysDays", { days: extraDays })}</Label>
          <p className="text-muted-foreground text-xs">
            {checked ? t("overpaymentBuysDaysOn", { days: extraDays }) : t("overpaymentBuysDaysOff")}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Mirrors Plan::endDateFrom on the API: months when the plan is sold in months, days otherwise. */
function planEndDateFrom(plan: PlanRow | undefined, startDate: string) {
  const start = parseDateOnly(startDate);

  if (!plan || !start) {
    return "";
  }

  if (plan.duration_months && plan.duration_months > 0) {
    const end = new Date(start.getTime());
    const targetMonth = end.getMonth() + plan.duration_months;
    const dayOfMonth = end.getDate();
    end.setDate(1);
    end.setMonth(targetMonth);
    // addMonthsNoOverflow: the 31st of a month that becomes a 30-day month
    // lands on the 30th, never on the 1st of the month after.
    end.setDate(Math.min(dayOfMonth, new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()));

    return formatDateOnly(end);
  }

  return formatDateOnly(addDays(start, plan.duration_days));
}

function Field({
  defaultValue,
  error,
  help,
  label,
  max,
  min,
  name,
  onChange,
  readOnly = false,
  required = false,
  step,
  type = "text",
  value,
}: {
  defaultValue?: string | null;
  error?: string;
  help?: string;
  label: string;
  max?: string;
  min?: string;
  name: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  readOnly?: boolean;
  required?: boolean;
  step?: string;
  type?: string;
  value?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={value === undefined ? (defaultValue ?? "") : undefined}
        max={max}
        min={min}
        step={step}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        required={required}
        aria-invalid={Boolean(error)}
      />
      {help ? <p className="text-muted-foreground text-xs">{help}</p> : null}
      <FieldError errors={error ? [{ message: error }] : undefined} />
    </div>
  );
}

function DateField({
  error,
  label,
  name,
  onValueChange,
  value,
}: {
  error?: string;
  label: string;
  name: string;
  onValueChange?: (value: string) => void;
  value?: string | null;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <FormDatePicker
        id={name}
        name={name}
        value={value ?? ""}
        onValueChange={onValueChange}
        placeholder={label}
        error={error}
      />
    </div>
  );
}
