"use client";

import type * as React from "react";

import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

import type { MemberPaymentHistory, MemberPaymentRow, MemberRow, MemberVisitRow } from "./data";

export function MemberDetailsDialog({
  history,
  member,
  onOpenChange,
  open,
  payments,
  visits,
}: {
  history: MemberPaymentHistory | null | undefined;
  member: MemberRow;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  payments: MemberPaymentRow[];
  visits: MemberVisitRow[];
}) {
  const t = useTranslations("Dashboard.membersPage");
  const locale = useLocale();

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
