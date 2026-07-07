"use client";

import * as React from "react";
import { useActionState } from "react";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CreditCard, ImageUp, MoreHorizontal, Receipt, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

import type { PlanRow } from "../../plans/_components/data";
import { recordMembershipPayment } from "../../crm/_components/actions";
import {
  changeMemberPlan,
  createMember,
  createMemberSubscription,
  deactivateMember,
  fetchMemberDetails,
  updateMember,
  uploadMemberPhoto,
} from "./actions";
import type {
  MemberDueRow,
  MemberPaymentHistory,
  MemberPaymentRow,
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const shouldOpenFromQuery = searchParams.get("create") === "member";

  React.useEffect(() => {
    if (shouldOpenFromQuery) {
      setOpen(true);
    }
  }, [shouldOpenFromQuery]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen && shouldOpenFromQuery) {
      const params = new URLSearchParams(searchParams);
      params.delete("create");
      const nextUrl = params.size ? `${pathname}?${params.toString()}` : pathname;
      router.replace(nextUrl, { scroll: false });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" />}>
        <UserPlus data-icon="inline-start" />
        {t("addMember")}
      </DialogTrigger>
      <MemberFormContent
        action={createMember}
        description={t("addMemberDescription")}
        submitLabel={t("createMember")}
        title={t("addMemberTitle")}
        onSuccess={() => setOpen(false)}
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
}: {
  due: MemberDueRow | null;
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
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [history, setHistory] = React.useState<MemberPaymentHistory | null>(null);
  const [payments, setPayments] = React.useState<MemberPaymentRow[]>([]);
  const [visits, setVisits] = React.useState<MemberVisitRow[]>([]);
  const detailsLoaded = React.useRef(false);

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

  return (
    <>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            if (member.latest_subscription) {
              setChangePlanOpen(true);
              return;
            }

            setSubscriptionOpen(true);
          }}
        >
          <CreditCard data-icon="inline-start" />
          {member.latest_subscription ? resolvedLabels.changePlan : resolvedLabels.addSubscription}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!due && !member.latest_subscription}
          onClick={() => setPaymentOpen(true)}
        >
          <Receipt data-icon="inline-start" />
          {resolvedLabels.addPayment}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={resolvedLabels.actionsFor({ name: member.name })}
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setDetailsOpen(true)}>{resolvedLabels.viewDetails}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>{resolvedLabels.editMember}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPhotoOpen(true)}>{resolvedLabels.uploadPhoto}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSubscriptionOpen(true)}>{resolvedLabels.addSubscription}</DropdownMenuItem>
              <DropdownMenuItem
                disabled={!member.latest_subscription}
                onClick={() => setChangePlanOpen(true)}
              >
                {resolvedLabels.changePlan}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!due && !member.latest_subscription} onClick={() => setPaymentOpen(true)}>
                {resolvedLabels.addPayment}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DeactivateMemberItem member={member} />
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <MemberDetailsDialog
        history={history}
        member={member}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        payments={payments}
        visits={visits}
        staff={staff}
      />
      <EditMemberControlledDialog member={member} open={editOpen} onOpenChange={setEditOpen} />
      <MemberPhotoControlledDialog member={member} open={photoOpen} onOpenChange={setPhotoOpen} />
      <MemberSubscriptionDialog
        member={member}
        plans={plans}
        open={subscriptionOpen}
        onOpenChange={setSubscriptionOpen}
      />
      <MemberChangePlanDialog member={member} plans={plans} open={changePlanOpen} onOpenChange={setChangePlanOpen} />
      <MemberPaymentDialog
        due={due}
        member={member}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        labels={resolvedLabels}
      />
    </>
  );
}

function EditMemberControlledDialog({
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

function MemberPhotoControlledDialog({
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

function MemberSubscriptionDialog({
  member,
  onOpenChange,
  open,
  plans,
}: {
  member: MemberRow;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  plans: PlanRow[];
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
        submitLabel={t("addSubscription")}
        title={t("addSubscription")}
        description={t("addSubscriptionDescription", { name: member.name })}
        kind="create"
      />
    </Dialog>
  );
}

function MemberChangePlanDialog({
  member,
  onOpenChange,
  open,
  plans,
}: {
  member: MemberRow;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  plans: PlanRow[];
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

  React.useEffect(() => {
    if (open) {
      setAmount(due?.balance ?? "");
      setPaymentMethod("cash");
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
  submitLabel: string;
  title: string;
}) {
  const t = useTranslations("Dashboard.membersPage");
  const router = useRouter();
  const initialPlan = plans[0];
  const currentSubscription = member.latest_subscription;
  const defaultStartDate = React.useMemo(() => formatDateOnly(new Date()), []);
  const [state, submit, pending] = useActionState(action, initialMemberFormState);
  const [selectedPlanId, setSelectedPlanId] = React.useState(initialPlan ? String(initialPlan.id) : "");
  const [startDate, setStartDate] = React.useState(defaultStartDate);
  const [discountType, setDiscountType] = React.useState<"fixed" | "percent">("fixed");
  const [discountValue, setDiscountValue] = React.useState("0");
  const selectedPlan = plans.find((plan) => String(plan.id) === selectedPlanId) ?? initialPlan;
  const endDate = kind === "create" && selectedPlan && startDate ? calculatePlanEndDate(startDate, selectedPlan) : "";
  const normalizedDiscount = selectedPlan ? calculateDiscountAmount(selectedPlan.price, discountValue, discountType) : "0";
  const paymentAmount = selectedPlan ? calculatePaymentAmount(selectedPlan.price, normalizedDiscount) : "";

  React.useEffect(() => {
    if (!state.ok) {
      return;
    }

    toast.success(state.message ?? submitLabel);
    onCancel();
    router.refresh();
  }, [onCancel, router, state.message, state.ok, submitLabel]);

  React.useEffect(() => {
    if (!initialPlan) {
      return;
    }

    setSelectedPlanId(String(initialPlan.id));
  }, [initialPlan]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedPlanId(initialPlan ? String(initialPlan.id) : "");
    setStartDate(defaultStartDate);
    setDiscountType("fixed");
    setDiscountValue("0");
  }, [defaultStartDate, initialPlan, open]);

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form action={submit} className="grid gap-4">
        <input type="hidden" name="member_id" value={member.id} />
        {kind === "change" ? (
          <input
            type="hidden"
            name="subscription_id"
            value={currentSubscription ? String(currentSubscription.id) : ""}
          />
        ) : null}
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
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="plan_id">{kind === "create" ? t("plan") : t("newPlan")}</Label>
            <FormSelect
              id="plan_id"
              name="plan_id"
              defaultValue={selectedPlanId}
              onValueChange={setSelectedPlanId}
              required
              placeholder={t("selectPlan")}
              error={fieldError(state, "plan_id")}
              options={plans.map((plan) => ({
                value: String(plan.id),
                label: `${plan.name} - ${plan.price} EGP`,
              }))}
            />
          </div>
          {kind === "create" ? (
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
            </div>
          ) : null}
          {kind === "create" ? (
            <div className="grid gap-2">
              <Label htmlFor="end_date">{t("endDate")}</Label>
              <input type="hidden" name="end_date" value={endDate} />
              <Input value={endDate || t("selectDate")} readOnly aria-readonly="true" id="end_date" />
              <FieldError errors={state.errors.end_date} />
            </div>
          ) : null}
          <Field
            error={fieldError(state, "payment_amount")}
            label={t("paymentAmount")}
            name="payment_amount"
            required
            type="number"
            value={paymentAmount}
            readOnly
          />
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
                  onChange={(event) => setDiscountValue(event.currentTarget.value)}
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
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            disabled={pending || plans.length === 0 || (kind === "change" && currentSubscription?.status !== "active")}
          >
            {pending ? t("saving") : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
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

function DeactivateMemberItem({ member }: { member: MemberRow }) {
  const t = useTranslations("Dashboard.membersPage");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <DropdownMenuItem
      variant="destructive"
      disabled={pending || member.status !== "active"}
      onClick={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("id", String(member.id));
        startTransition(async () => {
          try {
            await deactivateMember(formData);
            toast.success(t("memberDeactivated"));
            router.refresh();
          } catch (error) {
            toast.error(t("deactivateFailed"), {
              description: error instanceof Error ? error.message : t("pleaseTryAgain"),
            });
          }
        });
      }}
    >
      {t("deactivate")}
    </DropdownMenuItem>
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

  React.useEffect(() => {
    if (!state.ok) {
      return;
    }

    toast.success(state.message ?? submitLabel);
    onSuccess?.();
    router.refresh();
  }, [onSuccess, router, state.message, state.ok, submitLabel]);

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
            defaultValue={member?.name}
            required
          />
          <Field
            error={fieldError(state, "phone")}
            label={t("phone")}
            name="phone"
            defaultValue={member?.phone}
            required
          />
          <Field
            error={fieldError(state, "email")}
            label={t("email")}
            name="email"
            type="email"
            defaultValue={member?.email ?? ""}
          />
          <div className="grid gap-2">
            <Label htmlFor="member-gender">{t("gender")}</Label>
            <FormSelect
              id="member-gender"
              name="gender"
              defaultValue={member?.gender ?? ""}
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
            label={t("joinDate")}
            name="join_date"
            defaultValue={state.values.join_date ?? member?.join_date ?? ""}
          />
          <DateField
            error={fieldError(state, "birth_date")}
            label={t("birthDate")}
            name="birth_date"
            defaultValue={state.values.birth_date ?? member?.birth_date ?? ""}
          />
          <Field error={fieldError(state, "national_id")} label={t("nationalId")} name="national_id" defaultValue="" />
          <div className="grid gap-2">
            <Label htmlFor="member-status">{t("status")}</Label>
            <FormSelect
              id="member-status"
              name="status"
              defaultValue={member?.status ?? "active"}
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
          <Label htmlFor="member-notes">{t("notes")}</Label>
          <Textarea id="member-notes" name="notes" defaultValue={member?.notes ?? ""} />
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

function Field({
  defaultValue,
  error,
  label,
  name,
  onChange,
  readOnly = false,
  required = false,
  type = "text",
  value,
}: {
  defaultValue?: string | null;
  error?: string;
  label: string;
  name: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  readOnly?: boolean;
  required?: boolean;
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
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        required={required}
        aria-invalid={Boolean(error)}
      />
      <FieldError errors={error ? [{ message: error }] : undefined} />
    </div>
  );
}

function DateField({
  defaultValue,
  error,
  label,
  name,
}: {
  defaultValue?: string | null;
  error?: string;
  label: string;
  name: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <FormDatePicker id={name} name={name} defaultValue={defaultValue ?? ""} placeholder={label} error={error} />
    </div>
  );
}
