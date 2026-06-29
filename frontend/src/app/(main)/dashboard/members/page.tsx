import { Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, getInitials } from "@/lib/utils";

import { getMembersPageData } from "./_components/data";
import { AddMemberDialog, MemberActionsMenu, MemberDetailsMenuItem } from "./_components/member-action-dialogs";

export default async function Page() {
  const { histories, members, visits } = await getMembersPageData();
  const active = members.filter((member) => member.status === "active").length;
  const inactive = members.length - active;
  const withQr = members.filter((member) => member.attendance_qr).length;

  return (
    <Card className="mx-auto w-full max-w-[1440px] overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl tracking-tight">Members</h1>
            <p className="text-muted-foreground text-sm">
              Manage member profiles, QR attendance payloads, photos, and financial history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-64 pl-8" placeholder="Search members..." />
            </div>
            <Button size="sm" variant="outline">
              Hide
            </Button>
            <Button size="sm" variant="outline">
              Customize
            </Button>
            <Button nativeButton={false} size="sm" variant="outline" render={<a href="/api/finance/export" />}>
              Export
            </Button>
            <AddMemberDialog />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect label="Status" values={["All", "Active", "Inactive"]} />
              <FilterSelect label="Plan" values={["All", "Active plan", "No plan"]} />
              <FilterSelect label="QR" values={["All", "Ready", "Missing"]} />
            </div>
            <FilterSelect label="Rows" values={["15", "25", "50"]} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-sm">
            <span>0 selected</span>
            <div className="flex flex-wrap items-center gap-2">
              <Metric label="Total" value={members.length} />
              <Metric label="Active" value={active} />
              <Metric label="Inactive" value={inactive} />
              <Metric label="QR ready" value={withQr} />
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox aria-label="Select all members" />
              </TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>QR</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total paid</TableHead>
              <TableHead>Joined date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length > 0 ? (
              members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Checkbox aria-label={`Select ${member.name}`} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-muted-foreground text-xs">{member.phone}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{member.latest_subscription?.plan_name ?? "No subscription"}</div>
                    <div className="text-muted-foreground text-xs">
                      {member.latest_subscription?.status ?? "none"} · {member.expiry_date ?? "no expiry"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {member.attendance_qr ? (
                      <Badge variant="outline">Ready</Badge>
                    ) : (
                      <Badge variant="outline">Missing</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.status === "active" ? "secondary" : "outline"}>{member.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {formatCurrency(Number(member.total_paid), { currency: "EGP", noDecimals: true })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.join_date ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <MemberActionsMenu
                      member={member}
                      details={
                        <MemberDetailsMenuItem
                          history={histories[member.id]}
                          member={member}
                          visits={visits[member.id] ?? []}
                        />
                      }
                      visits={null}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No members returned by the backend.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Rows per page</span>
            <Select defaultValue="15">
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="text-muted-foreground">Page 1 of 1</div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({ label, values }: { label: string; values: string[] }) {
  return (
    <Select defaultValue={values[0]}>
      <SelectTrigger className="w-fit">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {values.map((value) => (
            <SelectItem key={value} value={value}>
              {label}: {value}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md border px-2 py-1">
      {label}: <span className="text-foreground tabular-nums">{value}</span>
    </span>
  );
}
