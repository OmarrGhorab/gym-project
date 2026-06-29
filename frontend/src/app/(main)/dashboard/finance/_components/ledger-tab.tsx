import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

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
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-7">
        <CardHeader>
          <CardTitle className="font-normal">Recent payments</CardTitle>
          <CardDescription>Backend payment records from subscriptions.</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentsTable payments={payments} />
        </CardContent>
      </Card>

      <Card className="xl:col-span-5">
        <CardHeader>
          <CardTitle className="font-normal">Outstanding dues</CardTitle>
          <CardDescription>Members with remaining subscription balances.</CardDescription>
        </CardHeader>
        <CardContent>
          <DuesTable dues={dues} />
        </CardContent>
      </Card>

      <Card className="xl:col-span-12">
        <CardHeader>
          <CardTitle className="font-normal">Expense ledger</CardTitle>
          <CardDescription>Operational expenses recorded in the backend.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpensesTable expenses={expenses} />
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentsTable({ payments }: { payments: FinancePayment[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Paid at</TableHead>
          <TableHead className="text-right">Amount</TableHead>
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
              <TableCell className="text-muted-foreground">{formatDate(payment.paid_at)}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(Number(payment.amount), { currency: "EGP", noDecimals: true })}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyRow colSpan={5} label="No payments yet." />
        )}
      </TableBody>
    </Table>
  );
}

function DuesTable({ dues }: { dues: FinanceDue[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Due</TableHead>
          <TableHead className="text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dues.length > 0 ? (
          dues.map((due) => (
            <TableRow key={getDueKey(due)}>
              <TableCell>
                <div className="font-medium">{due.member_name ?? `Member #${due.member_id ?? due.id}`}</div>
                <div className="text-muted-foreground text-xs">{due.plan_name ?? "Subscription balance"}</div>
              </TableCell>
              <TableCell className="text-muted-foreground">{due.due_date ?? "No due date"}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(Number(due.outstanding_balance ?? due.amount_due ?? 0), {
                  currency: "EGP",
                  noDecimals: true,
                })}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyRow colSpan={3} label="No outstanding dues." />
        )}
      </TableBody>
    </Table>
  );
}

function ExpensesTable({ expenses }: { expenses: FinanceExpense[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Created by</TableHead>
          <TableHead className="text-right">Amount</TableHead>
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
              <TableCell className="text-right">
                {formatCurrency(Number(expense.amount), { currency: "EGP", noDecimals: true })}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyRow colSpan={5} label="No expenses recorded." />
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

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en", {
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
