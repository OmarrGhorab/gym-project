import { getSystemHealthData } from "./_components/data";
import { InfrastructureHeader } from "./_components/infrastructure-header";
import { ProjectEnvironments, SystemHealthSidePanel } from "./_components/project-environments";

export default async function Page() {
  const data = await getSystemHealthData();

  return (
    <div className="flex flex-col gap-4">
      <InfrastructureHeader data={data} />

      <div className="flex flex-col gap-4">
        {data.groups.map((group) => (
          <ProjectEnvironments key={group.name} group={group} />
        ))}
      </div>

      <SystemHealthSidePanel audits={data.audit_activity} warnings={data.setup_warnings} />
    </div>
  );
}
