import { FileClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { getAuditPageData } from "./_components/data";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    from?: string;
    to?: string;
    subject?: string;
    causer?: string;
  }>;
}) {
  const query = await searchParams;
  const data = await getAuditPageData(query);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg border bg-muted text-muted-foreground">
              <FileClock className="size-4" />
            </div>
            <div>
              <CardTitle>Audit log</CardTitle>
              <CardDescription>Backend activity records, actors, subjects, and change metadata.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-end">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.logs.length > 0 ? (
                  data.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <span className="line-clamp-2">{log.description}</span>
                      </TableCell>
                      <TableCell>{log.causer?.name ?? log.causer_type ?? "System"}</TableCell>
                      <TableCell>{log.subject ? `${log.subject.type} #${log.subject.id}` : "-"}</TableCell>
                      <TableCell className="text-end text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No audit records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
