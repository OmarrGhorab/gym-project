"use client";

import * as React from "react";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ImageUp, MoreHorizontal, UserPlus } from "lucide-react";
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
import { FormDatePicker, FormSelect } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { PlanRow } from "../../plans/_components/data";
import {
  createMember,
  createMemberSubscription,
  deactivateMember,
  fetchMemberDetails,
  updateMember,
  uploadMemberPhoto,
} from "./actions";
import type { MemberPaymentHistory, MemberPaymentRow, MemberRow, MemberVisitRow, StaffOption } from "./data";
import { MemberDetailsDialog } from "./member-details-dialog";

type ActionResult = {
  label: string;
  run: (formData: FormData) => Promise<void>;
  success: string;
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
  const { pending, submit } = useActionSubmit(
    { label: t("createMember"), run: createMember, success: t("memberCreated") },
    () => setOpen(false),
  );
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
        description={t("addMemberDescription")}
        pending={pending}
        submit={submit}
        submitLabel={t("createMember")}
        title={t("addMemberTitle")}
      />
    </Dialog>
  );
}

export function EditMemberDialog({ member }: { member: MemberRow }) {
  const t = useTranslations("Dashboard.membersPage");
  const [open, setOpen] = React.useState(false);
  const { pending, submit } = useActionSubmit(
    { label: t("updateMember"), run: updateMember, success: t("memberUpdated") },
    () => setOpen(false),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" className="sr-only" />}>{t("editMember")}</DialogTrigger>
      <MemberFormContent
        description={t("editMemberDescription")}
        member={member}
        pending={pending}
        submit={submit}
        submitLabel={t("saveChanges")}
        title={t("editMember")}
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
  member,
  plans,
  staff,
}: {
  member: MemberRow;
  plans: PlanRow[];
  staff: StaffOption[];
}) {
  const t = useTranslations("Dashboard.membersPage");
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = React.useState(false);
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
            toast.error(t("pleaseTryAgain"), {
              description: error instanceof Error ? error.message : undefined,
            });
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [detailsOpen, member.id, t]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button size="icon-sm" variant="ghost" aria-label={t("actionsFor", { name: member.name })} />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setDetailsOpen(true)}>{t("viewDetails")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>{t("editMember")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPhotoOpen(true)}>{t("uploadPhoto")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSubscriptionOpen(true)}>{t("addSubscription")}</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DeactivateMemberItem member={member} />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
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
  const { pending, submit } = useActionSubmit(
    { label: t("updateMember"), run: updateMember, success: t("memberUpdated") },
    () => onOpenChange(false),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MemberFormContent
        description={t("editMemberDescription")}
        member={member}
        pending={pending}
        submit={submit}
        submitLabel={t("saveChanges")}
        title={t("editMember")}
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
  const { pending, submit } = useActionSubmit(
    { label: t("addSubscription"), run: createMemberSubscription, success: t("subscriptionAdded") },
    () => onOpenChange(false),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("addSubscription")}</DialogTitle>
          <DialogDescription>{t("addSubscriptionDescription", { name: member.name })}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <input type="hidden" name="member_id" value={member.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <span className="font-medium text-sm">{t("plan")}</span>
              <FormSelect
                name="plan_id"
                required
                placeholder={t("selectPlan")}
                options={plans.map((plan) => ({
                  value: String(plan.id),
                  label: `${plan.name} - ${plan.price} EGP`,
                }))}
              />
            </div>
            <div className="grid gap-2">
              <span className="font-medium text-sm">{t("startDate")}</span>
              <FormDatePicker name="start_date" placeholder={t("selectDate")} required />
            </div>
            <div className="grid gap-2">
              <span className="font-medium text-sm">{t("endDate")}</span>
              <FormDatePicker name="end_date" placeholder={t("selectDate")} required />
            </div>
            <Field label={t("paymentAmount")} name="payment_amount" required type="number" />
            <div className="grid gap-2">
              <span className="font-medium text-sm">{t("paymentMethod")}</span>
              <FormSelect
                name="payment_method"
                defaultValue="cash"
                options={[
                  { value: "cash", label: t("cash") },
                  { value: "card", label: t("card") },
                  { value: "bank_transfer", label: t("bankTransfer") },
                ]}
              />
            </div>
            <Field label={t("discount")} name="discount" type="number" defaultValue="0" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending || plans.length === 0}>
              {pending ? t("saving") : t("addSubscription")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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

function MemberFormContent({
  description,
  member,
  pending,
  submit,
  submitLabel,
  title,
}: {
  description: string;
  member?: MemberRow;
  pending: boolean;
  submit: (formData: FormData) => void;
  submitLabel: string;
  title: string;
}) {
  const t = useTranslations("Dashboard.membersPage");

  return (
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <form action={submit} className="grid gap-4">
        {member ? <input type="hidden" name="id" value={member.id} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("nameField")} name="name" defaultValue={member?.name} required />
          <Field label={t("phone")} name="phone" defaultValue={member?.phone} required />
          <Field label={t("email")} name="email" type="email" defaultValue={member?.email ?? ""} />
          <div className="grid gap-2">
            <span className="font-medium text-sm">{t("gender")}</span>
            <Select name="gender" defaultValue={member?.gender ?? ""}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectGender")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="male">{t("male")}</SelectItem>
                  <SelectItem value="female">{t("female")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <DateField label={t("joinDate")} name="join_date" defaultValue={member?.join_date ?? ""} />
          <DateField label={t("birthDate")} name="birth_date" defaultValue={member?.birth_date ?? ""} />
          <Field label={t("nationalId")} name="national_id" defaultValue="" />
          <div className="grid gap-2">
            <span className="font-medium text-sm">{t("status")}</span>
            <Select name="status" defaultValue={member?.status ?? "active"}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="active">{t("active")}</SelectItem>
                  <SelectItem value="inactive">{t("inactive")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <span className="font-medium text-sm">{t("notes")}</span>
          <Textarea name="notes" defaultValue={member?.notes ?? ""} />
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

function Field({
  defaultValue,
  label,
  name,
  required = false,
  type = "text",
}: {
  defaultValue?: string | null;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="grid gap-2">
      <span className="font-medium text-sm">{label}</span>
      <Input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} />
    </div>
  );
}

function DateField({ defaultValue, label, name }: { defaultValue?: string | null; label: string; name: string }) {
  return (
    <div className="grid gap-2">
      <span className="font-medium text-sm">{label}</span>
      <FormDatePicker name={name} defaultValue={defaultValue ?? ""} placeholder={label} />
    </div>
  );
}
