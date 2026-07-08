import { getTranslations } from "next-intl/server";

import { getStaffManagementPageData } from "../_components/data";
import { StaffManagement } from "../_components/staff-management";
import { StaffOperations } from "../_components/staff-operations";

export default async function Page() {
  const t = await getTranslations("Dashboard.academy");
  const data = await getStaffManagementPageData();

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">{t("staffManagement")}</h1>
        <p className="text-muted-foreground text-sm">{t("staffManagementDescription")}</p>
      </div>
      <StaffManagement employees={data.employees} shifts={data.shifts} users={data.users} roles={data.roles} />
      <StaffOperations settings={data.settings} shifts={data.shifts} />
    </div>
  );
}
