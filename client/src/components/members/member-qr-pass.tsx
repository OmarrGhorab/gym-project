"use client";

import * as React from "react";
import { Printer, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Member } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type MemberQrPassDialogProps = {
  member: Member;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MemberQrPassDialog({
  member,
  open,
  onOpenChange,
}: MemberQrPassDialogProps) {
  const locale = useLocale();
  const t = useTranslations("MembersPage");
  const isArabic = locale === "ar";
  const qrPayload = member.attendance_qr;
  const subscription = member.latest_subscription;

  function handlePrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md", isArabic && "rtl")}>
        <style>
          {`
            @media print {
              body * {
                visibility: hidden !important;
              }

              [data-member-qr-print],
              [data-member-qr-print] * {
                visibility: visible !important;
              }

              [data-member-qr-print] {
                position: fixed !important;
                inset: 0 !important;
                margin: auto !important;
                width: 86mm !important;
                min-height: 120mm !important;
                box-shadow: none !important;
                border: 1px solid #111827 !important;
                border-radius: 8px !important;
              }

              [data-member-qr-no-print] {
                display: none !important;
              }

              @page {
                size: A6 portrait;
                margin: 8mm;
              }
            }
          `}
        </style>
        <DialogHeader data-member-qr-no-print className={cn(isArabic && "text-right")}>
          <DialogTitle>{t("qrPassTitle", { name: member.name })}</DialogTitle>
          <DialogDescription>{t("qrPassDescription")}</DialogDescription>
        </DialogHeader>

        <div
          data-member-qr-print
          className="overflow-hidden rounded-lg border bg-white text-slate-950 shadow-sm"
          dir={isArabic ? "rtl" : "ltr"}
        >
          <div className="border-b bg-slate-950 px-5 py-4 text-white">
            <p className="text-xs font-bold uppercase tracking-wide text-white/70">
              {t("qrPassGymLabel")}
            </p>
            <h2 className="mt-1 text-xl font-black">{t("qrPassHeading")}</h2>
          </div>

          <div className="space-y-4 p-5">
            <div className="text-center">
              <p className="text-2xl font-black leading-tight">{member.name}</p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {member.phone || t("qrPassNoPhone")}
              </p>
            </div>

            <div className="grid place-items-center rounded-lg border border-slate-200 bg-white p-4">
              {qrPayload ? (
                <QRCodeSVG value={qrPayload} size={224} level="M" includeMargin />
              ) : (
                <div className="grid size-56 place-items-center rounded-md bg-slate-100 text-center text-sm font-bold text-slate-500">
                  <QrCode className="mb-2 size-8" />
                  {t("qrPassMissing")}
                </div>
              )}
            </div>

            <div className="grid gap-2 rounded-lg bg-slate-100 p-3 text-sm">
              <PassRow label={t("qrPassMemberId")} value={`#${member.id}`} />
              <PassRow label={t("qrPassCode")} value={member.attendance_code || "-"} mono />
              <PassRow label={t("qrPassPlan")} value={subscription?.plan_name || t("noSubscription")} />
              <PassRow label={t("qrPassExpiry")} value={formatDate(subscription?.end_date, locale)} />
              <PassRow label={t("qrPassStatus")} value={getStatusLabel(subscription?.status || member.status, t)} />
            </div>

            <p className="text-center text-xs font-semibold text-slate-500">
              {t("qrPassFooter")}
            </p>
          </div>
        </div>

        <DialogFooter data-member-qr-no-print className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("qrPassClose")}
          </Button>
          <Button type="button" onClick={handlePrint} disabled={!qrPayload}>
            <Printer className="size-4" />
            {t("qrPassPrint")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PassRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className={cn("text-sm font-black text-slate-950", mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}

function getStatusLabel(statusValue: string, t: (key: string) => string) {
  switch (statusValue?.toLowerCase()) {
    case "active":
      return t("statusActive");
    case "expired":
    case "inactive":
      return t("statusExpired");
    case "frozen":
    case "suspended":
      return t("statusSuspended");
    default:
      return statusValue || "-";
  }
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US");
}
