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
import { createMember, updateMember } from "@/lib/actions/members";
import type { Member } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";
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
  const locale = useLocale();
  const t = useTranslations("MembersPage");
  const isArabic = locale === "ar";
  const isEditing = mode === "edit";

  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const data = {
      name: String(formData.get("name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim() || undefined,
      gender: (formData.get("gender") as "male" | "female") || undefined,
      birth_date: String(formData.get("birth_date") ?? "").trim() || undefined,
      national_id: String(formData.get("national_id") ?? "").trim() || undefined,
      join_date: String(formData.get("join_date") ?? "").trim() || undefined,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
      ...(isEditing
        ? {
            status: (formData.get("status") as "active" | "inactive") || undefined,
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
      setError(err instanceof Error ? err.message : t("formError"));
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
      <DialogContent className={cn("max-w-lg", isArabic && "rtl")}>
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
          key={open ? "open" : "closed"}
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
                defaultValue={member?.name}
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className={cn(isArabic && "justify-end")}>
                {t("formPhone")} *
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={member?.phone}
                required
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className={cn(isArabic && "justify-end")}>
                {t("formEmail")}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={member?.email}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gender" className={cn(isArabic && "justify-end")}>
                {t("formGender")}
              </Label>
              <select
                id="gender"
                name="gender"
                defaultValue={member?.gender ?? ""}
                className={cn(
                  "h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50",
                  isArabic && "text-right"
                )}
              >
                <option value="">{t("formGenderPlaceholder")}</option>
                <option value="male">{t("filterGenderMale")}</option>
                <option value="female">{t("filterGenderFemale")}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="birth_date" className={cn(isArabic && "justify-end")}>
                {t("formBirthDate")}
              </Label>
              <DatePicker
                id="birth_date"
                name="birth_date"
                defaultValue={member?.birth_date}
                placeholder={t("formBirthDatePlaceholder")}
                locale={locale}
                className={cn(isArabic && "text-right")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="national_id" className={cn(isArabic && "justify-end")}>
                {t("formNationalId")}
              </Label>
              <Input
                id="national_id"
                name="national_id"
                defaultValue={member?.national_id}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="join_date" className={cn(isArabic && "justify-end")}>
                {t("formJoinDate")}
              </Label>
              <DatePicker
                id="join_date"
                name="join_date"
                defaultValue={member?.join_date}
                placeholder={t("formJoinDatePlaceholder")}
                locale={locale}
                className={cn(isArabic && "text-right")}
              />
            </div>

            {isEditing && (
              <div className="space-y-1.5">
                <Label htmlFor="status" className={cn(isArabic && "justify-end")}>
                  {t("formStatus")}
                </Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={member?.status ?? "active"}
                  className={cn(
                    "h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50",
                    isArabic && "text-right"
                  )}
                >
                  <option value="active">{t("statusActive")}</option>
                  <option value="inactive">{t("statusExpired")}</option>
                </select>
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
              defaultValue={member?.notes}
              rows={3}
              className={cn("w-full resize-none", isArabic && "text-right")}
            />
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
          <Button type="submit" form="member-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditing ? t("formSave") : t("formAdd")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
