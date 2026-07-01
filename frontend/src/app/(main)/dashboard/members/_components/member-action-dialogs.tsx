"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { MoreHorizontal, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormDatePicker } from "@/components/ui/form-controls";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { createMember, deactivateMember, fetchMemberDetails, updateMember, uploadMemberPhoto } from "./actions";
import type { MemberPaymentHistory, MemberRow, MemberVisitRow } from "./data";
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
  const [open, setOpen] = React.useState(false);
  const { pending, submit } = useActionSubmit(
    { label: t("createMember"), run: createMember, success: t("memberCreated") },
    () => setOpen(false),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
  const { pending, submit } = useActionSubmit(
    { label: t("uploadPhoto"), run: uploadMemberPhoto, success: t("memberPhotoUpdated") },
    () => setOpen(false),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" className="sr-only" />}>{t("uploadPhoto")}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("uploadPhoto")}</DialogTitle>
          <DialogDescription>{t("uploadPhotoDescription", { name: member.name })}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <input type="hidden" name="member_id" value={member.id} />
          <Input name="photo" type="file" accept="image/*" required />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("uploading") : t("uploadPhoto")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MemberActionsMenu({ member }: { member: MemberRow }) {
  const t = useTranslations("Dashboard.membersPage");
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const [history, setHistory] = React.useState<MemberPaymentHistory | null>(null);
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
        visits={visits}
      />
      <EditMemberControlledDialog member={member} open={editOpen} onOpenChange={setEditOpen} />
      <MemberPhotoControlledDialog member={member} open={photoOpen} onOpenChange={setPhotoOpen} />
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
  const { pending, submit } = useActionSubmit(
    { label: t("uploadPhoto"), run: uploadMemberPhoto, success: t("memberPhotoUpdated") },
    () => onOpenChange(false),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("uploadPhoto")}</DialogTitle>
          <DialogDescription>{t("uploadPhotoDescription", { name: member.name })}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <input type="hidden" name="member_id" value={member.id} />
          <Input name="photo" type="file" accept="image/*" required />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("uploading") : t("uploadPhoto")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
