"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import type { MemberPaymentHistory, MemberRow, MemberVisitRow } from "./data";

export function MemberDetailsDialog({
  children = "Details",
  history,
  member,
  trigger,
  visits,
}: {
  children?: React.ReactNode;
  history: MemberPaymentHistory | null | undefined;
  member: MemberRow;
  trigger?: React.ReactElement;
  visits: MemberVisitRow[];
}) {
  return (
    <Dialog>
      <DialogTrigger render={trigger ?? <Button type="button" size="sm" variant="outline" />}>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{member.name}</DialogTitle>
          <DialogDescription>
            {member.phone} · {member.latest_subscription?.plan_name ?? "No active plan"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Metric label="Subscription paid" value={history?.totals.subscription_paid ?? member.total_paid} />
          <Metric label="Product purchases" value={history?.totals.product_paid ?? "0"} />
          <Metric label="Total paid" value={history?.totals.total_paid ?? member.total_paid} />
          <Metric label="Outstanding" value={history?.totals.outstanding_balance ?? "0"} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border">
            <div className="border-b p-3">
              <h3 className="font-medium text-sm">Subscription payments</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history?.subscription_payments.length ? (
                  history.subscription_payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.plan_name ?? `Subscription #${payment.subscription_id}`}</TableCell>
                      <TableCell>
                        <Badge variant={payment.status === "paid" ? "secondary" : "outline"}>{payment.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(payment.paid_at)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(payment.amount), { currency: "EGP", noDecimals: true })}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <EmptyRow colSpan={4} label="No subscription payments." />
                )}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg border">
            <div className="border-b p-3">
              <h3 className="font-medium text-sm">Member visits</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Check in</TableHead>
                  <TableHead>Check out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.length ? (
                  visits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell>{formatDate(visit.check_in_at)}</TableCell>
                      <TableCell>{formatDate(visit.check_out_at)}</TableCell>
                      <TableCell>
                        <Badge variant={visit.status === "allowed" ? "secondary" : "outline"}>{visit.status}</Badge>
                      </TableCell>
                      <TableCell className="capitalize">{visit.scan_method}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <EmptyRow colSpan={4} label="No visits recorded." />
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="border-b p-3">
            <h3 className="font-medium text-sm">Product purchases</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sold by</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history?.product_purchases.length ? (
                history.product_purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>#{purchase.id}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {purchase.items.map((item) => `${item.product_name ?? "Product"} x${item.quantity}`).join(", ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={purchase.status === "completed" ? "secondary" : "outline"}>
                        {purchase.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{purchase.sold_by ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(purchase.total), { currency: "EGP", noDecimals: true })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <EmptyRow colSpan={5} label="No product purchases." />
              )}
            </TableBody>
          </Table>
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

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell className="h-16 text-center text-muted-foreground" colSpan={colSpan}>
        {label}
      </TableCell>
    </TableRow>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}
