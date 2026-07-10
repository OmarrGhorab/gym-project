import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {["summary", "activity", "status", "trend"].map((name) => (
          <Skeleton key={name} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
