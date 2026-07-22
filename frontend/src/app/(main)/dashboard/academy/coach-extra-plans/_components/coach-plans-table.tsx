"use client";

import { useState } from "react";

import { Calendar, CheckCircle2, ChevronRight, Dumbbell, Eye, Search, UserCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import type { CoachExtraPlanItem } from "./data";

export function CoachPlansTable({ coaches }: { coaches: CoachExtraPlanItem[] }) {
  const [search, setSearch] = useState("");
  const [selectedCoach, setSelectedCoach] = useState<CoachExtraPlanItem | null>(null);

  const filteredCoaches = coaches.filter((c) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;
    return (
      c.coach_name.toLowerCase().includes(query) ||
      (c.coach_role && c.coach_role.toLowerCase().includes(query)) ||
      c.plans_summary.some((p) => p.plan_name.toLowerCase().includes(query))
    );
  });

  return (
    <Card className="shadow-2xs">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-xl tracking-tight font-semibold">Coach Add-on Plans & Attendance</CardTitle>
          <CardDescription>Performance breakdown of member subscriptions and attendance days by coach.</CardDescription>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 text-sm"
            placeholder="Search coach or plan name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>

      <CardContent>
        {filteredCoaches.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No coaches or add-on plan subscriptions found matching filter.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold">Coach</TableHead>
                  <TableHead className="font-semibold text-center">Subscribed Members</TableHead>
                  <TableHead className="font-semibold text-center">Attended Days (This Month)</TableHead>
                  <TableHead className="font-semibold text-center">Total Visits</TableHead>
                  <TableHead className="font-semibold">Plans Summary</TableHead>
                  <TableHead className="font-semibold text-right">Add-on Revenue</TableHead>
                  <TableHead className="font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCoaches.map((coach) => (
                  <TableRow key={coach.coach_id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                          {coach.coach_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-foreground text-sm">{coach.coach_name}</div>
                          <div className="text-muted-foreground text-xs">{coach.coach_role || "Coach"}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-semibold text-xs">
                        <Users className="mr-1 size-3 text-primary" />
                        {coach.subscribed_members_count} member{coach.subscribed_members_count === 1 ? "" : "s"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-700 text-xs dark:text-emerald-300"
                      >
                        <Calendar className="mr-1 size-3 text-emerald-500" />
                        {coach.attended_days_count} day{coach.attended_days_count === 1 ? "" : "s"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium tabular-nums text-sm">
                      {coach.total_visits_count}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {coach.plans_summary.map((p, idx) => (
                          <Badge key={idx} variant="outline" className="bg-muted/30 text-[11px]">
                            {p.plan_name} ({p.count})
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-sm">
                      {formatCurrency(Number(coach.total_revenue), { currency: "EGP" })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        onClick={() => setSelectedCoach(coach)}
                      >
                        <Eye className="size-3.5" />
                        View Members ({coach.members.length})
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Member Details Dialog */}
        <Dialog open={selectedCoach !== null} onOpenChange={(open) => !open && setSelectedCoach(null)}>
          {selectedCoach ? (
            <DialogContent className="!w-[min(1100px,calc(100vw-2rem))] !max-w-[min(1100px,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto p-5 sm:p-6 sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Dumbbell className="size-5 text-primary" />
                  {selectedCoach.coach_name} — Member Subscriptions & Attendance
                </DialogTitle>
                <DialogDescription>
                  Subscribed members for extra add-on plans with {selectedCoach.coach_name} and their check-in
                  attendance days this month.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-muted-foreground text-xs">Total Members</p>
                    <p className="font-semibold text-lg">{selectedCoach.subscribed_members_count}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-muted-foreground text-xs">Attended Days This Month</p>
                    <p className="font-semibold text-emerald-600 text-lg dark:text-emerald-400">
                      {selectedCoach.attended_days_count} days
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-muted-foreground text-xs">Total Check-ins Logged</p>
                    <p className="font-semibold text-lg">{selectedCoach.total_visits_count}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-muted-foreground text-xs">Add-on Revenue</p>
                    <p className="font-semibold text-lg">
                      {formatCurrency(Number(selectedCoach.total_revenue), { currency: "EGP" })}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="font-semibold">Member</TableHead>
                        <TableHead className="font-semibold">Add-on Plan</TableHead>
                        <TableHead className="font-semibold text-center">Status</TableHead>
                        <TableHead className="font-semibold text-center">Sessions (Used / Total)</TableHead>
                        <TableHead className="font-semibold text-center">Attended Days (This Month)</TableHead>
                        <TableHead className="font-semibold text-right">Price Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCoach.members.map((m) => (
                        <TableRow key={m.addon_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{m.member_name}</p>
                              {m.member_code ? <p className="text-muted-foreground text-xs">#{m.member_code}</p> : null}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-sm">{m.plan_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={m.status === "active" ? "default" : "secondary"}
                              className={
                                m.status === "active"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0"
                                  : ""
                              }
                            >
                              {m.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center tabular-nums text-sm">
                            <span className="font-medium">{m.sessions_used}</span> / {m.sessions_total} used
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className="border-primary/30 bg-primary/10 font-semibold text-primary text-xs"
                            >
                              <UserCheck className="mr-1 size-3" />
                              {m.attended_days_this_month} days ({m.total_visits_this_month} visits)
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums text-sm">
                            {formatCurrency(Number(m.price_paid), { currency: "EGP" })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </DialogContent>
          ) : null}
        </Dialog>
      </CardContent>
    </Card>
  );
}
