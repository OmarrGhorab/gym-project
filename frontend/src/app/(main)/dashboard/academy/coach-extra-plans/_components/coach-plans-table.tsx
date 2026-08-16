"use client";

import { useState } from "react";

import { Calendar, Dumbbell, Eye, Search, UserCheck, Users } from "lucide-react";

import { Money } from "@/components/money/money";
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
  const [memberPage, setMemberPage] = useState(1);

  const filteredCoaches = coaches.filter((c) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;
    return (
      c.coach_name.toLowerCase().includes(query) ||
      c.coach_role?.toLowerCase().includes(query) ||
      c.plans_summary.some((p) => p.plan_name.toLowerCase().includes(query))
    );
  });
  const memberPageSize = 10;
  const memberTotalPages = Math.max(1, Math.ceil((selectedCoach?.members.length ?? 0) / memberPageSize));
  const currentMemberPage = Math.min(memberPage, memberTotalPages);
  const displayedMembers = selectedCoach?.members.slice(
    (currentMemberPage - 1) * memberPageSize,
    currentMemberPage * memberPageSize,
  );

  return (
    <Card className="shadow-2xs">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-semibold text-xl tracking-tight">Coach Add-on Plans & Attendance</CardTitle>
          <CardDescription>Performance breakdown of member subscriptions and attendance days by coach.</CardDescription>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
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
                  <TableHead className="text-center font-semibold">Subscribed Members</TableHead>
                  <TableHead className="text-center font-semibold">Attended Days (This Month)</TableHead>
                  <TableHead className="text-center font-semibold">Total Visits</TableHead>
                  <TableHead className="font-semibold">Plans Summary</TableHead>
                  <TableHead className="text-right font-semibold">Add-on Revenue</TableHead>
                  <TableHead className="text-center font-semibold">Actions</TableHead>
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
                    <TableCell className="text-center font-medium text-sm tabular-nums">
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
                    <TableCell className="text-right font-medium text-sm tabular-nums">
                      <Money domain="subscriptions">
                        {formatCurrency(Number(coach.total_revenue), { currency: "EGP" })}
                      </Money>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        onClick={() => {
                          setMemberPage(1);
                          setSelectedCoach(coach);
                        }}
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
            <DialogContent className="!w-[min(1200px,calc(100vw-2rem))] !max-w-[min(1200px,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto p-5 sm:max-w-5xl sm:p-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Dumbbell className="size-5 text-primary" />
                  {selectedCoach.coach_name} — Coached Plans & Member Details
                </DialogTitle>
                <DialogDescription>
                  Detailed overview of members subscribed to extra-on services or fitness studio plans coached by{" "}
                  {selectedCoach.coach_name} ({selectedCoach.coach_role || "Coach"}
                  {selectedCoach.coach_phone ? ` · ${selectedCoach.coach_phone}` : ""}).
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
                    <p className="text-muted-foreground text-xs">Coached Revenue</p>
                    <Money domain="subscriptions" className="block font-semibold text-lg">
                      {formatCurrency(Number(selectedCoach.total_revenue), { currency: "EGP" })}
                    </Money>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="font-semibold">Member</TableHead>
                        <TableHead className="font-semibold">Plan & Category</TableHead>
                        <TableHead className="font-semibold">Duration (Start – End)</TableHead>
                        <TableHead className="text-center font-semibold">Status</TableHead>
                        <TableHead className="text-center font-semibold">Sessions</TableHead>
                        <TableHead className="text-center font-semibold">Attended Days (This Month)</TableHead>
                        <TableHead className="text-right font-semibold">Price Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCoach.members.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground text-sm">
                            No member subscriptions found for this coach.
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayedMembers?.map((m, index) => (
                          <TableRow key={`${m.type ?? "item"}-${m.addon_id}-${m.member_id}-${index}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{m.member_name}</p>
                                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                  {m.member_phone ? <span>{m.member_phone}</span> : null}
                                  {m.member_code ? <span>(#{m.member_code})</span> : null}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{m.plan_name}</p>
                                <Badge variant="outline" className="mt-0.5 bg-muted/40 text-[10px]">
                                  {m.plan_category ?? "Coached Plan"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                              {m.start_date || "N/A"} → {m.end_date || "N/A"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={m.status === "active" ? "default" : "secondary"}
                                className={
                                  m.status === "active"
                                    ? "border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                    : ""
                                }
                              >
                                {m.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-sm tabular-nums">
                              {m.sessions_total > 0 ? (
                                <div>
                                  <span className="font-medium">{m.sessions_used}</span> / {m.sessions_total} used
                                  <p className="text-muted-foreground text-xs">({m.sessions_remaining} left)</p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">Unlimited</span>
                              )}
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
                            <TableCell className="text-right font-medium text-sm tabular-nums">
                              <Money domain="subscriptions">
                                {formatCurrency(Number(m.price_paid), { currency: "EGP" })}
                              </Money>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {selectedCoach.members.length > memberPageSize ? (
                  <div className="flex items-center justify-between gap-3 text-muted-foreground text-sm">
                    <span>
                      Page {currentMemberPage} of {memberTotalPages} · {selectedCoach.members.length} members
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={currentMemberPage === 1}
                        onClick={() => setMemberPage((page) => Math.max(1, page - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={currentMemberPage === memberTotalPages}
                        onClick={() => setMemberPage((page) => Math.min(memberTotalPages, page + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </DialogContent>
          ) : null}
        </Dialog>
      </CardContent>
    </Card>
  );
}
