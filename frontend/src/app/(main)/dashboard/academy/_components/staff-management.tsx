import { UserPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { AcademyEmployee } from "./data";
import { EmployeeActionForm, type EmployeeActionPermissions } from "./staff-action-forms";

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
  permissions,
  shifts,
  users,
}: {
  employees: AcademyEmployee[];
  permissions: EmployeeActionPermissions;
  shifts: ShiftOption[];
  users: UserOption[];
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
          {permissions.canCreate ? (
            <EmployeeActionForm shifts={shifts} users={users} permissions={permissions} />
          ) : null}
          {employees.map((employee) => (
            <EmployeeActionForm
              key={employee.id}
              employee={employee}
              shifts={shifts}
              users={users}
              permissions={permissions}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
