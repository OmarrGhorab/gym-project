"use client";

import * as React from "react";
import { Eye, Loader2, Pencil, UserX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { deactivateMember } from "@/lib/actions/members";
import type { Member } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type MemberRowActionsProps = {
  member: Member;
  onEdit?: (member: Member) => void;
  onMutate?: () => void;
};

export function MemberRowActions({
  member,
  onEdit,
  onMutate,
}: MemberRowActionsProps) {
  const locale = useLocale();
  const t = useTranslations("MembersPage");
  const isArabic = locale === "ar";

  const [isPending, setIsPending] = React.useState(false);

  async function handleDeactivate() {
    const confirmed = window.confirm(
      t("deactivateDescription", { name: member.name })
    );

    if (!confirmed) return;

    setIsPending(true);

    try {
      await deactivateMember(member.id, locale as AppLocale);
      onMutate?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("formError"));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <div className={cn("flex items-center gap-1", isArabic ? "justify-start" : "justify-end")}>
        <Button
          size="icon-sm"
          variant="ghost"
          className="size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          title={t("actions.edit")}
          onClick={() => onEdit?.(member)}
        >
          <Pencil className="size-4" />
        </Button>

        <Link
          href={`/members/${member.id}`}
          title={t("actions.view")}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Eye className="size-4" />
        </Link>

        <Button
          size="icon-sm"
          variant="ghost"
          className="size-8 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title={t("actions.delete")}
          onClick={handleDeactivate}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UserX className="size-4" />
          )}
        </Button>
      </div>
    </>
  );
}
