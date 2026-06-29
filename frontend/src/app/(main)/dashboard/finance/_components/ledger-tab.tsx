import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import { deleteExpenseForm, recordPaymentForm, updateExpenseForm } from "./actions";
import type { FinanceDue, FinanceExpense, FinancePayment } from "./data";

export function LedgerTab({
  dues,
  expenses,
  payments,
}: {
  dues: FinanceDue[];
  expenses: FinanceExpense[];
  payments: FinancePayment[];
}) {
  const t = useTranslations("Dashboard.finance");

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-7">
        <CardHeader>
          <CardTitle className="font-normal">{t("recentPayments")}</CardTitle>
          <CardDescription>{t("recentPaymentsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentsTable payments={payments} />
        </CardContent>
      </Card>

      <Card className="xl:col-span-5">
        <CardHeader>
          <CardTitle className="font-normal">{t("outstandingDues")}</CardTitle>
          <CardDescription>{t("outstandingDuesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DuesTable dues={dues} />
        </CardContent>
      </Card>

      <Card className="xl:col-span-12">
        <CardHeader>
          <CardTitle className="font-normal">{t("expenseLedger")}</CardTitle>
          <CardDescription>{t("expenseLedgerDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpensesTable expenses={expenses} />
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

function DuesTable({ dues }: { dues: FinanceDue[] }) {
  const t = useTranslations("Dashboard.finance");

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("member")}</TableHead>
          <TableHead>{t("due")}</TableHead>
          <TableHead className="text-end">{t("balance")}</TableHead>
          <TableHead className="text-end">{t("actions.title")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dues.length > 0 ? (
          dues.map((due) => (
            <TableRow key={getDueKey(due)}>
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
              <TableCell>
                {due.subscription_id ? (
                  <form action={recordPaymentForm} className="flex justify-end gap-2">
                    <input type="hidden" name="subscription_id" value={due.subscription_id} />
                    <Input
                      className="h-8 w-24"
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={due.outstanding_balance ?? due.amount_due ?? ""}
                      aria-label={t("amount")}
                    />
                    <NativeSelect name="method" defaultValue="cash" className="w-24">
                      <option value="cash">{t("paymentMethods.cash")}</option>
                      <option value="card">{t("paymentMethods.card")}</option>
                      <option value="bank_transfer">{t("paymentMethods.bank_transfer")}</option>
                    </NativeSelect>
                    <Button type="submit" size="sm">
                      {t("collect")}
                    </Button>
                  </form>
                ) : (
                  <span className="text-muted-foreground text-xs">{t("notAvailable")}</span>
                )}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyRow colSpan={4} label={t("noOutstandingDues")} />
        )}
      </TableBody>
    </Table>
  );
}

function ExpensesTable({ expenses }: { expenses: FinanceExpense[] }) {
  const t = useTranslations("Dashboard.finance");

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("date")}</TableHead>
          <TableHead>{t("category")}</TableHead>
          <TableHead>{t("description")}</TableHead>
          <TableHead>{t("createdBy")}</TableHead>
          <TableHead className="text-end">{t("amount")}</TableHead>
          <TableHead className="text-end">{t("actions.title")}</TableHead>
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
              <TableCell>
                <form action={updateExpenseForm} className="grid min-w-[520px] grid-cols-[1fr_110px_130px_auto_auto] gap-2">
                  <input type="hidden" name="id" value={expense.id} />
                  <Input name="category" defaultValue={expense.category} aria-label={t("category")} />
                  <Input name="amount" type="number" min="0.01" step="0.01" defaultValue={expense.amount} aria-label={t("amount")} />
                  <Input name="date" type="date" defaultValue={expense.date ?? ""} aria-label={t("date")} />
                  <input type="hidden" name="description" value={expense.description ?? ""} />
                  <Button type="submit" size="sm">
                    {t("save")}
                  </Button>
                  <Button formAction={deleteExpenseForm} type="submit" size="sm" variant="outline">
                    {t("delete")}
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyRow colSpan={6} label={t("noExpenses")} />
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

function getDueKey(due: FinanceDue) {
  return [
    due.subscription_id ?? "subscription",
    due.id,
    due.member_id ?? due.member_name ?? "member",
    due.plan_name ?? "plan",
    due.due_date ?? "date",
    due.outstanding_balance ?? due.amount_due ?? "balance",
  ].join("-");
}
