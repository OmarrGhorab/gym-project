"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { decideFreezeApproval } from "./freeze-approval-actions";

export type FreezeApprovalLabels = {
  approve: string;
  dismiss: string;
  working: string;
};

export function FreezeApprovalButtons({
  data,
  labels,
  onResolved,
}: {
  data: Record<string, unknown>;
  labels: FreezeApprovalLabels;
  onResolved?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const subscriptionId = Number(data.subscription_id);
  const freezeRequestId = Number(data.freeze_request_id);

  if (!isPendingFreezeApproval(data) || !Number.isInteger(subscriptionId) || !Number.isInteger(freezeRequestId)) {
    return null;
  }

  function decide(event: React.MouseEvent<HTMLButtonElement>, decision: "approve" | "dismiss") {
    event.preventDefault();
    event.stopPropagation();

    startTransition(async () => {
      const result = await decideFreezeApproval(subscriptionId, freezeRequestId, decision);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onResolved?.();
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={pending}
        onClick={(event) => decide(event, "approve")}
      >
        <Check className="size-3.5" />
        {pending ? labels.working : labels.approve}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        disabled={pending}
        onClick={(event) => decide(event, "dismiss")}
      >
        <X className="size-3.5" />
        {labels.dismiss}
      </Button>
    </div>
  );
}

export function isPendingFreezeApproval(data: Record<string, unknown>) {
  return (
    data.category === "membership.freeze_approval_requested" &&
    data.approval_status === "pending" &&
    data.requires_action === true
  );
}
