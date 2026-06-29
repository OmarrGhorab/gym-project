import { getUsersPageData } from "./_components/data";
import { Users } from "./_components/users";

export default async function Page() {
  const data = await getUsersPageData();

  return <Users roles={data.roles} users={data.users} />;
}
