import { UserPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { AcademyEmployee, AccessRole } from "./data";
import { EmployeeActionForm } from "./staff-action-forms";

type ShiftOption = {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
};

type UserOption = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

export async function StaffManagement({
  employees,
  shifts,
  users,
  roles,
}: {
  employees: AcademyEmployee[];
  shifts: ShiftOption[];
  users: UserOption[];
  roles: AccessRole[];
}) {
  const t = await getTranslations("Dashboard.academy");

  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-normal">
            <UserPlus className="size-4" />
            {t("staffManagement")}
          </CardTitle>
          <CardDescription>{t("staffManagementDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <EmployeeActionForm shifts={shifts} users={users} roles={roles} />
          {employees.map((employee) => (
            <EmployeeActionForm key={employee.id} employee={employee} shifts={shifts} users={users} roles={roles} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
