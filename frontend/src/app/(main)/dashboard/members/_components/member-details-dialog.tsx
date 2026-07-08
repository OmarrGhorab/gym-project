"use client";

import type * as React from "react";

import Image from "next/image";

import { Copy, Download, MessageCircle, QrCode } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { buildQrImageUrl, buildWhatsAppUrl } from "@/lib/whatsapp";

import type { MemberPaymentHistory, MemberPaymentRow, MemberRow, MemberVisitRow, StaffOption } from "./data";
import { MemberReportControls } from "./member-report-controls";

export function MemberDetailsDialog({
  history,
  member,
  onOpenChange,
  open,
  payments,
  visits,
  staff,
}: {
  history: MemberPaymentHistory | null | undefined;
  member: MemberRow;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  payments: MemberPaymentRow[];
  visits: MemberVisitRow[];
  staff: StaffOption[];
}) {
  const t = useTranslations("Dashboard.membersPage");
  const locale = useLocale();
  const qrPayload = member.attendance_qr ?? member.attendance_code ?? null;

  function handleOpenWhatsApp() {
    const url = buildWhatsAppUrl(member.phone, buildMemberWhatsAppMessage(member, t, locale));

    if (!url) {
      toast.error(t("whatsAppPhoneMissing"));
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open === undefined ? (
        <Button type="button" size="sm" variant="outline">
          {t("details")}
        </Button>
      ) : null}
      <DialogContent className="!w-[min(1400px,calc(100vw-2rem))] !max-w-[min(1400px,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto overflow-x-hidden p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle>{member.name}</DialogTitle>
          <DialogDescription>
            {member.phone} · {member.latest_subscription?.plan_name ?? t("noActivePlan")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Metric label={t("subscriptionPaid")} value={history?.totals.subscription_paid ?? member.total_paid} />
          <Metric label={t("productPurchases")} value={history?.totals.product_paid ?? "0"} />
          <Metric label={t("totalPaid")} value={history?.totals.total_paid ?? member.total_paid} />
          <Metric label={t("outstanding")} value={history?.totals.outstanding_balance ?? "0"} />
        </div>

        <div className="rounded-lg border p-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium text-sm">{t("memberReport")}</h3>
              <p className="text-muted-foreground text-xs">{t("memberReportDescription")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handleOpenWhatsApp}>
                <MessageCircle data-icon="inline-start" />
                {t("sendWhatsApp")}
              </Button>
              <Button asChild type="button" size="sm" variant="outline">
                <a href={`/api/members/${member.id}/report/export?format=xlsx`} download>
                  <Download data-icon="inline-start" />
                  {t("exportReportXlsx")}
                </a>
              </Button>
              <Button asChild type="button" size="sm" variant="outline">
                <a href={`/api/members/${member.id}/report/export?format=pdf`} download>
                  <Download data-icon="inline-start" />
                  {t("exportReportPdf")}
                </a>
              </Button>
            </div>
          </div>
          <MemberReportControls memberId={member.id} staff={staff} />
        </div>

        <QrPanel payload={qrPayload} />

        <div className="grid min-w-0 gap-4 xl:grid-cols-3">
          <Section
            title={t("subscriptionPayments")}
            empty={t("noSubscriptionPayments")}
            hasItems={Boolean(history?.subscription_payments.length)}
          >
            {history?.subscription_payments.map((payment) => (
              <PaymentItem
                key={payment.id}
                title={payment.plan_name ?? `Subscription #${payment.subscription_id}`}
                status={payment.status}
                date={formatDate(payment.paid_at, locale)}
                amount={payment.amount}
              />
            ))}
          </Section>

          <Section title={t("directPayments")} empty={t("noDirectPayments")} hasItems={payments.length > 0}>
            {payments.map((payment) => (
              <PaymentItem
                key={payment.id}
                title={formatMethod(payment.method)}
                status={payment.status}
                date={formatDate(payment.paid_at, locale)}
                amount={payment.amount}
              />
            ))}
          </Section>

          <Section title={t("memberVisits")} empty={t("noVisits")} hasItems={visits.length > 0}>
            {visits.map((visit) => (
              <div key={visit.id} className="grid gap-2 rounded-lg border bg-background p-3">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <p className="truncate font-medium text-sm">{formatDate(visit.check_in_at, locale)}</p>
                  <Badge variant={visit.status === "allowed" ? "secondary" : "outline"}>{visit.status}</Badge>
                </div>
                <div className="grid gap-1 text-muted-foreground text-xs">
                  <span>
                    {t("checkOut")}: {formatDate(visit.check_out_at, locale)}
                  </span>
                  <span className="capitalize">
                    {t("method")}: {formatMethod(visit.scan_method)}
                  </span>
                </div>
              </div>
            ))}
          </Section>
        </div>

        <div className="min-w-0 rounded-lg border">
          <div className="border-b p-3">
            <h3 className="font-medium text-sm">{t("productPurchases")}</h3>
          </div>
          <div className="grid gap-2 p-3">
            {history?.product_purchases.length ? (
              history.product_purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="grid gap-2 rounded-lg border bg-background p-3 lg:grid-cols-[auto_1fr_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      {t("sale")} #{purchase.id}
                    </p>
                    <p className="text-muted-foreground text-xs">{purchase.sold_by ?? "-"}</p>
                  </div>
                  <p className="min-w-0 text-muted-foreground text-sm">
                    {purchase.items.map((item) => `${item.product_name ?? t("product")} x${item.quantity}`).join(", ")}
                  </p>
                  <div className="flex items-center justify-between gap-3 lg:justify-end">
                    <Badge variant={purchase.status === "completed" ? "secondary" : "outline"}>{purchase.status}</Badge>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(Number(purchase.total), { currency: "EGP", noDecimals: true })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState label={t("noProductPurchases")} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildMemberWhatsAppMessage(
  member: MemberRow,
  t: ReturnType<typeof useTranslations<"Dashboard.membersPage">>,
  locale: string,
) {
  const subscription = member.latest_subscription;
  const addons = Array.isArray(subscription?.addons) ? subscription.addons : [];
  const qrPayload = member.attendance_qr ?? member.attendance_code ?? null;
  const qrImageUrl = buildQrImageUrl(qrPayload, 320);
  const addonLines = addons
    .map((addon) => {
      if (!addon || typeof addon !== "object") {
        return null;
      }

      const plan = "plan" in addon && addon.plan && typeof addon.plan === "object" ? addon.plan : null;
      const coach = "coach" in addon && addon.coach && typeof addon.coach === "object" ? addon.coach : null;
      const name = plan && "name" in plan ? String(plan.name ?? "").trim() : "";

      if (!name) {
        return null;
      }

      const coachName = coach && "name" in coach ? String(coach.name ?? "").trim() : "";

      return coachName ? `- ${name} - ${t("whatsAppCoach")}: ${coachName}` : `- ${name}`;
    })
    .filter((value): value is string => Boolean(value));

  const lines: string[] =
    locale === "ar"
      ? [
          `مرحبًا ${member.name}`,
          subscription ? "تم تسجيل اشتراكك بنجاح." : "تم تسجيل بياناتك بنجاح.",
          `${t("phone")}: ${member.phone}`,
          `${t("member")}: ${member.name}`,
          `${t("subscription")}: ${subscription?.plan_name ?? t("noActivePlan")}`,
          `${t("joinedDate")}: ${member.join_date ?? t("missing")}`,
        ]
      : [
          `Hello ${member.name},`,
          subscription
            ? "your membership has been added successfully."
            : "your member profile has been added successfully.",
          `${t("phone")}: ${member.phone}`,
          `${t("member")}: ${member.name}`,
          `${t("subscription")}: ${subscription?.plan_name ?? t("noActivePlan")}`,
          `${t("joinedDate")}: ${member.join_date ?? t("missing")}`,
        ];

  if (subscription?.start_date) {
    lines.push(`${locale === "ar" ? "تبدأ" : "Starts"}: ${subscription.start_date}`);
  }

  if (subscription?.end_date) {
    lines.push(`${locale === "ar" ? "تنتهي" : "Ends"}: ${subscription.end_date}`);
  }

  if (qrPayload) {
    lines.push(`${t("memberQr")}: ${qrPayload}`);

    if (qrImageUrl) {
      lines.push(`${t("memberQrImage")}: ${qrImageUrl}`);
    }
  }

  if (addonLines.length > 0) {
    lines.push("");
    lines.push(t("whatsAppAddons"));
    lines.push(...addonLines);
  }

  return lines.join("\n");
}

function QrPanel({ payload }: { payload: string | null }) {
  const t = useTranslations("Dashboard.membersPage");
  const qrUrl = buildQrImageUrl(payload, 220);

  async function handleCopy() {
    if (!payload) {
      return;
    }

    try {
      await navigator.clipboard.writeText(payload);
      toast.success(t("qrCopied"));
    } catch {
      toast.error(t("copyQrFailed"));
    }
  }

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
        <div className="min-w-0">
          <h3 className="font-medium text-sm">{t("memberQr")}</h3>
          <p className="text-muted-foreground text-xs">{t("memberQrDescription")}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={handleCopy} disabled={!payload}>
          <Copy data-icon="inline-start" />
          {t("copyQr")}
        </Button>
      </div>
      <div className="grid gap-4 p-3 lg:grid-cols-[240px_1fr] lg:items-center">
        <div className="flex aspect-square w-full max-w-60 items-center justify-center rounded-lg border bg-background">
          {qrUrl ? (
            <Image
              src={qrUrl}
              alt={t("memberQr")}
              width={220}
              height={220}
              unoptimized
              className="size-full rounded-lg object-contain p-2"
            />
          ) : (
            <div className="grid place-items-center gap-2 text-center text-muted-foreground">
              <QrCode className="size-9" />
              <span className="text-xs">{t("missing")}</span>
            </div>
          )}
        </div>
        <div className="grid gap-2">
          <p className="text-muted-foreground text-xs">{t("qrText")}</p>
          <div className="break-all rounded-lg border bg-muted/30 p-3 font-mono text-sm">{payload ?? t("missing")}</div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium tabular-nums">{formatCurrency(Number(value), { currency: "EGP", noDecimals: true })}</p>
    </div>
  );
}

function Section({
  children,
  empty,
  hasItems,
  title,
}: {
  children: React.ReactNode;
  empty: string;
  hasItems: boolean;
  title: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border">
      <div className="border-b p-3">
        <h3 className="font-medium text-sm">{title}</h3>
      </div>
      <div className="grid max-h-80 gap-2 overflow-y-auto overflow-x-hidden p-3">
        {hasItems ? children : <EmptyState label={empty} />}
      </div>
    </div>
  );
}

function PaymentItem({ amount, date, status, title }: { amount: string; date: string; status: string; title: string }) {
  return (
    <div className="grid gap-2 rounded-lg border bg-background p-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="truncate font-medium text-sm capitalize">{title}</p>
        <Badge variant={status === "paid" ? "secondary" : "outline"}>{status}</Badge>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate text-muted-foreground">{date}</span>
        <span className="font-medium tabular-nums">
          {formatCurrency(Number(amount), { currency: "EGP", noDecimals: true })}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed text-center text-muted-foreground text-sm">
      {label}
    </div>
  );
}

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString(locale, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function formatMethod(value: string | null | undefined) {
  return (value ?? "-").replaceAll("_", " ");
}
