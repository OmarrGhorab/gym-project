import { Download, FileArchive, FileText, IdCard, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";

import { DocumentCenter } from "./_components/document-center";
import { getDocumentCenterData } from "./_components/document-center-data";

export default async function Page() {
  const data = await getDocumentCenterData();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-medium text-3xl leading-none tracking-tight">Gym Document Center</h1>
          <p className="text-muted-foreground text-sm">
            Print member QR cards, download salary receipts, export finance reports, and recover POS receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button render={<a href="/api/finance/export" />} nativeButton={false} variant="outline">
            <FileArchive data-icon="inline-start" />
            Finance export
          </Button>
          {data.payroll[0] ? (
            <Button render={<a href={`/api/payroll/${data.payroll[0].id}/payslip`} />} nativeButton={false}>
              <Download data-icon="inline-start" />
              Latest payslip
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard icon={ReceiptText} label="Salary receipts" value={data.payroll.length.toString()} />
        <SummaryCard icon={FileText} label="Sale receipts" value={data.sales.length.toString()} />
        <SummaryCard icon={IdCard} label="Member QR cards" value={data.members.length.toString()} />
        <SummaryCard icon={FileArchive} label="Pending warnings" value={data.attendance.pendingViolations.toString()} />
      </div>

      <DocumentCenter data={data} />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof ReceiptText; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="font-medium text-2xl tabular-nums">{value}</p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}
