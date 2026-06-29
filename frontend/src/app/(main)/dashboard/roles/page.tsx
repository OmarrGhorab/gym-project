import { getRolesPageData } from "./_components/data-live";
import { Roles } from "./_components/roles";

export default async function Page() {
  const data = await getRolesPageData();

  return <Roles permissionGroups={data.permissionGroups} roles={data.roles} />;
}
