"use client";

import * as React from "react";
import { DoorOpen, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AttendanceFormDialog } from "@/components/attendance/attendance-form-dialog";
import { MemberVisitDialog } from "@/components/attendance/member-visit-dialog";
import { AttendanceTable } from "@/components/attendance/attendance-table";
import type { Attendance } from "@/lib/api/dashboard";

export function AttendanceTableContainer({
  attendance,
}: {
  attendance: Attendance[];
}) {
  const t = useTranslations("AttendancePage");
  const [dialogMode, setDialogMode] = React.useState<"add" | "edit">("add");
  const [selectedAttendance, setSelectedAttendance] =
    React.useState<Attendance | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isMemberVisitOpen, setIsMemberVisitOpen] = React.useState(false);

  function openAddDialog() {
    setDialogMode("add");
    setSelectedAttendance(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(row: Attendance) {
    setDialogMode("edit");
    setSelectedAttendance(row);
    setIsDialogOpen(true);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 border-b px-4 py-3">
        <Button type="button" size="sm" variant="outline" onClick={() => setIsMemberVisitOpen(true)}>
          <DoorOpen className="size-4" />
          {t("memberVisitButton")}
        </Button>
        <Button type="button" size="sm" onClick={openAddDialog}>
          <Plus className="size-4" />
          {t("addButton")}
        </Button>
      </div>
      <AttendanceTable attendance={attendance} onEdit={openEditDialog} />
      <AttendanceFormDialog
        mode={dialogMode}
        attendance={selectedAttendance}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
      <MemberVisitDialog
        open={isMemberVisitOpen}
        onOpenChange={setIsMemberVisitOpen}
      />
    </>
  );
}
