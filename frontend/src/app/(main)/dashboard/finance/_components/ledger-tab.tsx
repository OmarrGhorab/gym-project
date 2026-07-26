"use client";

import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import type { FinanceDue, FinanceExpense, FinancePayment } from "./data";
import { DuePaymentForm } from "./due-payment-form";
import { ExpenseRowActions } from "./expense-row-actions";

export function LedgerTab({
  canCollectDue,
  canManageExpenses,
  dues,
  expenses,
  payments,
}: {
  canCollectDue: boolean;
  canManageExpenses: boolean;
  dues: FinanceDue[];
  expenses: FinanceExpense[];
  payments: FinancePayment[];
}) {
  const t = useTranslations("Dashboard.finance");

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card id="recent-payments" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="font-normal">{t("recentPayments")}</CardTitle>
          <CardDescription>{t("recentPaymentsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentsTable payments={payments} />
        </CardContent>
      </Card>

      <Card id="outstanding-dues" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="font-normal">{t("outstandingDues")}</CardTitle>
          <CardDescription>{t("outstandingDuesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DuesTable canCollectDue={canCollectDue} dues={dues} />
        </CardContent>
      </Card>

      <Card id="expense-ledger" className="scroll-mt-24">
        <CardHeader>
          <CardTitle className="font-normal">{t("expenseLedger")}</CardTitle>
          <CardDescription>{t("expenseLedgerDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpensesTable canManageExpenses={canManageExpenses} expenses={expenses} />
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentsTable({ payments }: { payments: FinancePayment[] }) {
  const t = useTranslations("Dashboard.finance");
  const locale = useLocale();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("id")}</TableHead>
          <TableHead>{t("method")}</TableHead>
          <TableHead>{t("status")}</TableHead>
          <TableHead>{t("paidAt")}</TableHead>
          <TableHead className="text-end">{t("amount")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.length > 0 ? (
          payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>#{payment.id}</TableCell>
              <TableCell className="capitalize">{payment.method.replace("_", " ")}</TableCell>
              <TableCell>
                <Badge variant={payment.status === "paid" ? "secondary" : "outline"}>{payment.status}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(payment.paid_at, locale)}</TableCell>
              <TableCell className="text-end">
                {formatCurrency(Number(payment.amount), { currency: "EGP", noDecimals: true })}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyRow colSpan={5} label={t("noPayments")} />
        )}
      </TableBody>
    </Table>
  );
}

function DuesTable({ canCollectDue, dues }: { canCollectDue: boolean; dues: FinanceDue[] }) {
  const t = useTranslations("Dashboard.finance");

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("member")}</TableHead>
          <TableHead>{t("due")}</TableHead>
          <TableHead className="text-end">{t("balance")}</TableHead>
          {canCollectDue ? <TableHead className="text-end">{t("actionsTitle")}</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {dues.length > 0 ? (
          dues.map((due, index) => (
            <TableRow key={getDueKey(due, index)}>
              <TableCell>
                <div className="font-medium">{due.member_name ?? `Member #${due.member_id ?? due.id}`}</div>
                <div className="text-muted-foreground text-xs">{due.plan_name ?? t("subscriptionBalance")}</div>
              </TableCell>
              <TableCell className="text-muted-foreground">{due.due_date ?? t("noDueDate")}</TableCell>
              <TableCell className="text-end">
                {formatCurrency(Number(due.outstanding_balance ?? due.amount_due ?? 0), {
                  currency: "EGP",
                  noDecimals: true,
                })}
              </TableCell>
              {canCollectDue ? (
                <TableCell>
                  {due.subscription_id ? (
                    <DuePaymentForm
                      subscriptionId={due.subscription_id}
                      amount={due.outstanding_balance ?? due.amount_due ?? ""}
                    />
                  ) : (
                    <span className="text-muted-foreground text-xs">{t("notAvailable")}</span>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          ))
        ) : (
          <EmptyRow colSpan={canCollectDue ? 4 : 3} label={t("noOutstandingDues")} />
        )}
      </TableBody>
    </Table>
  );
}

function ExpensesTable({ canManageExpenses, expenses }: { canManageExpenses: boolean; expenses: FinanceExpense[] }) {
  const t = useTranslations("Dashboard.finance");
  const locale = useLocale();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("date")}</TableHead>
          <TableHead>{t("category")}</TableHead>
          <TableHead>{t("description")}</TableHead>
          <TableHead>{t("createdBy")}</TableHead>
          <TableHead className="text-end">{t("amount")}</TableHead>
          {canManageExpenses ? <TableHead className="text-end">{t("actionsTitle")}</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.length > 0 ? (
          expenses.map((expense) => (
            <TableRow key={expense.id}>
              <TableCell>{expense.date ?? "-"}</TableCell>
              <TableCell className="capitalize">{expense.category}</TableCell>
              <TableCell className="text-muted-foreground">{expense.description ?? "-"}</TableCell>
              <TableCell>{expense.creator?.name ?? "-"}</TableCell>
              <TableCell className="text-end">
                {formatCurrency(Number(expense.amount), { currency: "EGP", noDecimals: true })}
              </TableCell>
              {canManageExpenses ? (
                <TableCell>
                  <ExpenseRowActions
                    id={expense.id}
                    category={expense.category}
                    amount={expense.amount}
                    date={expense.date ?? ""}
                    description={expense.description}
                    locale={locale}
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))
        ) : (
          <EmptyRow colSpan={canManageExpenses ? 6 : 5} label={t("noExpenses")} />
        )}
      </TableBody>
    </Table>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell className="h-20 text-center text-muted-foreground" colSpan={colSpan}>
        {label}
      </TableCell>
    </TableRow>
  );
}

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDueKey(due: FinanceDue, index: number) {
  return [
    due.subscription_id ?? "subscription",
    due.id,
    due.member_id ?? due.member_name ?? "member",
    due.plan_name ?? "plan",
    due.due_date ?? "date",
    due.outstanding_balance ?? due.amount_due ?? "balance",
    index,
  ].join("-");
}
