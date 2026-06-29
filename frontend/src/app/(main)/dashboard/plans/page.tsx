import { PackageCheck, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

import { createPlan, deletePlan, togglePlan } from "./_components/actions";
import { getPlansPageData } from "./_components/data";

export default async function Page() {
  const plans = await getPlansPageData();
  const active = plans.filter((plan) => plan.is_active).length;
  const sellable = plans.filter((plan) => plan.is_sellable).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">Membership Plans</h1>
        <p className="text-muted-foreground text-sm">Backend plans used by subscriptions, renewals, pricing, and freezes.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Summary label="Plans" value={plans.length.toString()} />
        <Summary label="Active" value={active.toString()} />
        <Summary label="Sellable today" value={sellable.toString()} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-normal">
              <Plus className="size-4" />
              Create plan
            </CardTitle>
            <CardDescription>Add a membership offer directly to the backend.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createPlan} className="grid gap-4">
              <Field label="Name" name="name" />
              <Field label="Type" name="type" defaultValue="monthly" />
              <Field label="Price" name="price" type="number" step="0.01" />
              <Field label="Duration days" name="duration_days" type="number" defaultValue="30" />
              <Field label="Sessions count" name="sessions_count" type="number" />
              <Field label="Max freeze days" name="max_freeze_days" type="number" defaultValue="0" />
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" />
              </div>
              <Button type="submit">
                <PackageCheck />
                Create plan
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle className="font-normal">Plans catalog</CardTitle>
            <CardDescription>Toggle or delete plans. Backend blocks deletion if active subscriptions exist.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div className="font-medium">{plan.name}</div>
                      <div className="line-clamp-1 text-muted-foreground text-xs">{plan.description}</div>
                    </TableCell>
                    <TableCell>{plan.type}</TableCell>
                    <TableCell>{formatCurrency(Number(plan.price), { currency: "EGP", noDecimals: true })}</TableCell>
                    <TableCell>{plan.duration_days} days</TableCell>
                    <TableCell>
                      <Badge variant={plan.is_active ? "secondary" : "outline"}>{plan.is_active ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <form action={togglePlan}>
                          <input type="hidden" name="id" value={plan.id} />
                          <Button type="submit" size="sm" variant="outline">
                            {plan.is_active ? "Disable" : "Enable"}
                          </Button>
                        </form>
                        <form action={deletePlan}>
                          <input type="hidden" name="id" value={plan.id} />
                          <Button type="submit" size="sm" variant="destructive">
                            Delete
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No plans found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  defaultValue = "",
  label,
  name,
  step,
  type = "text",
}: {
  defaultValue?: string;
  label: string;
  name: string;
  step?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} step={step} defaultValue={defaultValue} />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="font-medium text-2xl tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
