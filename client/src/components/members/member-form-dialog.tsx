"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import {
  createMember,
  getMemberForEdit,
  updateMember,
} from "@/lib/actions/members";
import type { Member } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";
import { MemberActionError } from "@/lib/member-action-error";
import { cn } from "@/lib/utils";

type MemberFormDialogProps = {
  mode: "add" | "edit";
  member?: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function MemberFormDialog({
  mode,
  member,
  open,
  onOpenChange,
  onSuccess,
}: MemberFormDialogProps) {
  const formKey = `${mode}-${member?.id ?? "new"}-${open ? "open" : "closed"}`;

  return (
    <MemberFormDialogContent
      key={formKey}
      member={member}
      mode={mode}
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />
  );
}

type MemberFormState = {
  name: string;
  phone: string;
  email: string;
  gender: "" | "male" | "female";
  birth_date?: string;
  national_id: string;
  join_date?: string;
  notes: string;
  status: "active" | "inactive";
};

function MemberFormDialogContent({
  mode,
  member,
  open,
  onOpenChange,
  onSuccess,
}: MemberFormDialogProps) {
  const locale = useLocale();
  const t = useTranslations("MembersPage");
  const isArabic = locale === "ar";
  const isEditing = mode === "edit";
  const [portalContainer, setPortalContainer] = React.useState<HTMLDivElement | null>(null);

  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [form, setForm] = React.useState<MemberFormState>(() =>
    toMemberFormState(member)
  );

  React.useEffect(() => {
    if (!open || !isEditing || !member?.id) {
      return;
    }

    let isCancelled = false;

    getMemberForEdit(member.id)
      .then((fullMember) => {
        if (isCancelled) return;
        setForm(toMemberFormState(fullMember));
        setFieldErrors({});
      })
      .catch((err) => {
        if (isCancelled) return;
        setError(err instanceof Error ? err.message : t("formError"));
      });

    return () => {
      isCancelled = true;
    };
  }, [open, isEditing, member?.id, t]);

  function updateForm<K extends keyof MemberFormState>(
    key: K,
    value: MemberFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setFieldErrors({});

    const data = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      gender: form.gender || undefined,
      birth_date: form.birth_date || undefined,
      national_id: form.national_id.trim() || undefined,
      join_date: form.join_date || undefined,
      notes: form.notes.trim() || undefined,
      ...(isEditing
        ? {
            status: form.status,
          }
        : {}),
    };

    try {
      if (isEditing && member) {
        await updateMember(member.id, data, locale as AppLocale);
      } else {
        await createMember(data, locale as AppLocale);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      if (err instanceof MemberActionError) {
        setError(err.message);
        setFieldErrors(err.details ?? {});
      } else {
        setError(err instanceof Error ? err.message : t("formError"));
      }
    } finally {
      setIsPending(false);
    }
  }

  const inputClass = cn(
    "h-9 w-full",
    isArabic ? "text-right" : "text-left"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={setPortalContainer}
        className={cn("max-w-lg", isArabic && "rtl")}
      >
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>
            {isEditing ? t("editMemberTitle") : t("addMemberTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t("editMemberDescription") : t("addMemberDescription")}
          </DialogDescription>
        </DialogHeader>

        <form
          id="member-form"
          key={`${mode}-${member?.id ?? "new"}-${open ? "open" : "closed"}`}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name" className={cn(isArabic && "justify-end")}>
                {t("formName")} *
              </Label>
              <Input
                id="name"
                name="name"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                required
                className={inputClass}
              />
              <FieldError messages={fieldErrors.name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className={cn(isArabic && "justify-end")}>
                {t("formPhone")} *
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
                required
                className={inputClass}
              />
              <FieldError messages={fieldErrors.phone} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className={cn(isArabic && "justify-end")}>
                {t("formEmail")}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
                className={inputClass}
              />
              <FieldError messages={fieldErrors.email} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gender" className={cn(isArabic && "justify-end")}>
                {t("formGender")}
              </Label>
              <select
                id="gender"
                name="gender"
                value={form.gender}
                onChange={(event) =>
                  updateForm("gender", event.target.value as "" | "male" | "female")
                }
                className={cn(
                  "h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50",
                  isArabic && "text-right"
                )}
              >
                <option value="">{t("formGenderPlaceholder")}</option>
                <option value="male">{t("filterGenderMale")}</option>
                <option value="female">{t("filterGenderFemale")}</option>
              </select>
              <FieldError messages={fieldErrors.gender} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="birth_date" className={cn(isArabic && "justify-end")}>
                {t("formBirthDate")}
              </Label>
              <DatePicker
                id="birth_date"
                name="birth_date"
                value={form.birth_date}
                onChange={(date) => updateForm("birth_date", date)}
                placeholder={t("formBirthDatePlaceholder")}
                locale={locale}
                portalContainer={portalContainer}
                disabled={isPending}
                className={cn(isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.birth_date} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="national_id" className={cn(isArabic && "justify-end")}>
                {t("formNationalId")}
              </Label>
              <Input
                id="national_id"
                name="national_id"
                value={form.national_id}
                onChange={(event) => updateForm("national_id", event.target.value)}
                className={inputClass}
              />
              <FieldError messages={fieldErrors.national_id} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="join_date" className={cn(isArabic && "justify-end")}>
                {t("formJoinDate")}
              </Label>
              <DatePicker
                id="join_date"
                name="join_date"
                value={form.join_date}
                onChange={(date) => updateForm("join_date", date)}
                placeholder={t("formJoinDatePlaceholder")}
                locale={locale}
                portalContainer={portalContainer}
                disabled={isPending}
                className={cn(isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.join_date} />
            </div>

            {isEditing && (
              <div className="space-y-1.5">
                <Label htmlFor="status" className={cn(isArabic && "justify-end")}>
                  {t("formStatus")}
                </Label>
                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={(event) =>
                    updateForm("status", event.target.value as "active" | "inactive")
                  }
                  className={cn(
                    "h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50",
                    isArabic && "text-right"
                  )}
                >
                  <option value="active">{t("statusActive")}</option>
                  <option value="inactive">{t("statusInactive")}</option>
                </select>
                <FieldError messages={fieldErrors.status} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className={cn(isArabic && "justify-end")}>
              {t("formNotes")}
            </Label>
            <Textarea
              id="notes"
              name="notes"
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              rows={3}
              className={cn("w-full resize-none", isArabic && "text-right")}
            />
            <FieldError messages={fieldErrors.notes} />
          </div>
        </form>

        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("formCancel")}
          </Button>
          <Button
            type="submit"
            form="member-form"
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditing ? t("formSave") : t("formAdd")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toMemberFormState(member?: Member | null): MemberFormState {
  return {
    name: member?.name ?? "",
    phone: member?.phone ?? "",
    email: member?.email ?? "",
    gender:
      member?.gender === "male" || member?.gender === "female"
        ? member.gender
        : "",
    birth_date: member?.birth_date ?? undefined,
    national_id: member?.national_id ?? "",
    join_date: member?.join_date ?? undefined,
    notes: member?.notes ?? "",
    status: member?.status === "inactive" ? "inactive" : "active",
  };
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs font-medium text-destructive">{messages[0]}</p>;
}
