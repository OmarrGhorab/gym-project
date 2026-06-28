"use client";

import * as React from "react";
import { Eye, Loader2, Pencil, QrCode, SquareMinus, UserX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { deactivateMember, stopSubscription } from "@/lib/actions/members";
import { MemberQrPassDialog } from "@/components/members/member-qr-pass";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const [isStopPending, setIsStopPending] = React.useState(false);
  const [isQrOpen, setIsQrOpen] = React.useState(false);

  async function handleDeactivate() {
    const confirmed = window.confirm(
      t("deactivateDescription", { name: member.name })
    );

    if (!confirmed) return;

    setIsPending(true);

    try {
      await deactivateMember(member.id, locale as AppLocale);
      toast.success(t("memberDeactivatedSuccess"));
      onMutate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setIsPending(false);
    }
  }

  async function handleStopSubscription() {
    const subscriptionId = member.latest_subscription?.id;

    if (!subscriptionId) return;

    const confirmed = window.confirm(
      t("stopSubscriptionDescription", { name: member.name })
    );

    if (!confirmed) return;

    setIsStopPending(true);

    try {
      await stopSubscription(subscriptionId, locale as AppLocale);
      toast.success(t("subscriptionStoppedSuccess"));
      onMutate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setIsStopPending(false);
    }
  }

  const subscriptionStatus = member.latest_subscription?.status?.toLowerCase();
  const canStopSubscription =
    member.latest_subscription?.id !== undefined &&
    subscriptionStatus !== "expired" &&
    subscriptionStatus !== "stopped";

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", isArabic ? "justify-start" : "justify-end")}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onEdit?.(member)}
              >
                <Pencil className="size-4" />
              </Button>
            }
          />
          <TooltipContent>{t("actions.edit")}</TooltipContent>
        </Tooltip>

        {member.latest_subscription?.id && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="size-8 rounded-md text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600"
                  onClick={handleStopSubscription}
                  disabled={isStopPending || !canStopSubscription}
                >
                  {isStopPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <SquareMinus className="size-4" />
                  )}
                </Button>
              }
            />
            <TooltipContent>{t("actions.stopSubscription")}</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href={`/members/${member.id}`}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Eye className="size-4" />
              </Link>
            }
          />
          <TooltipContent>{t("actions.view")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-8 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                onClick={() => setIsQrOpen(true)}
              >
                <QrCode className="size-4" />
              </Button>
            }
          />
          <TooltipContent>{t("actions.printQr")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-8 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDeactivate}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserX className="size-4" />
                )}
              </Button>
            }
          />
          <TooltipContent>{t("actions.delete")}</TooltipContent>
        </Tooltip>

        <MemberQrPassDialog
          member={member}
          open={isQrOpen}
          onOpenChange={setIsQrOpen}
        />
      </div>
    </TooltipProvider>
  );
}
