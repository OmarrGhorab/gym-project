import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const skeletonRows = Array.from({ length: 10 }, (_, index) => `member-loading-row-${index}`);

export default function MembersLoading() {
  return (
    <Card className="mx-auto w-full max-w-[1440px] overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Filter bar skeleton */}
        <div className="flex flex-col gap-3 border-b p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-4 w-36" />
        </div>

        {/* Metrics bar skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <Skeleton className="h-4 w-24" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-20 rounded-md" />
            <Skeleton className="h-7 w-20 rounded-md" />
            <Skeleton className="h-7 w-24 rounded-md" />
            <Skeleton className="h-7 w-24 rounded-md" />
          </div>
        </div>

        {/* Table skeleton */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Skeleton className="size-4" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-8" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-12" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead>
                <Skeleton className="h-4 w-24" />
              </TableHead>
              <TableHead className="text-end">
                <Skeleton className="ml-auto h-4 w-16" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skeletonRows.map((rowId) => (
              <TableRow key={rowId}>
                <TableCell>
                  <Skeleton className="size-4" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="text-end">
                  <Skeleton className="ml-auto size-8 rounded-md" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
