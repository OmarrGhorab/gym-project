import { format } from "date-fns";
import { Calculator, UserPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { AcademyEmployee, AccessRole } from "./data";
import { CommissionBackfillForm, EmployeeActionForm } from "./staff-action-forms";

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
  plans,
  shifts,
  users,
  roles,
}: {
  employees: AcademyEmployee[];
  plans: {
    id: number;
    name: string;
    price: string;
  }[];
  shifts: ShiftOption[];
  users: UserOption[];
  roles: AccessRole[];
}) {
  const t = await getTranslations("Dashboard.academy");
  const today = format(new Date(), "yyyy-MM-dd");
  const from = format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

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
          <EmployeeActionForm plans={plans} shifts={shifts} users={users} roles={roles} />
          {employees.map((employee) => (
            <EmployeeActionForm
              key={employee.id}
              employee={employee}
              plans={plans}
              shifts={shifts}
              users={users}
              roles={roles}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-normal">
            <Calculator className="size-4" />
            {t("commissionBackfill")}
          </CardTitle>
          <CardDescription>{t("commissionBackfillDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CommissionBackfillForm from={from} today={today} />
        </CardContent>
      </Card>
    </div>
  );
}
