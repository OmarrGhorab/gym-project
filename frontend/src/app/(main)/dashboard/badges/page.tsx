import Link from "next/link";

import { Barcode } from "@/components/ui/barcode";
import { Button } from "@/components/ui/button";

import { type BadgeSubject, type BadgeType, getBadgeSubjects } from "./_components/data";
import { PrintBadgesButton } from "./_components/print-button";

type PageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const type: BadgeType = params.type === "member" ? "member" : "employee";
  const subjects = await getBadgeSubjects(type);

  return (
    <div className="flex flex-col gap-4">
      {/* print:hidden keeps the chrome off the printed sheet. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between print:hidden">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">Scan badges</h1>
          <p className="max-w-2xl text-muted-foreground text-sm">
            Print these and a handheld barcode scanner can check people in. The code is Code128, which both laser and
            imaging scanners read — unlike a QR code, which needs an imaging scanner.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/badges?type=employee" />}
            size="sm"
            variant={type === "employee" ? "default" : "outline"}
          >
            Staff
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/badges?type=member" />}
            size="sm"
            variant={type === "member" ? "default" : "outline"}
          >
            Members
          </Button>
          <PrintBadgesButton label="Print" />
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm print:hidden">
          Nobody here has an attendance code yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-2">
          {subjects.map((subject) => (
            <BadgeCard key={`${type}-${subject.id}`} subject={subject} />
          ))}
        </div>
      )}
    </div>
  );
}

function BadgeCard({ subject }: { subject: BadgeSubject }) {
  return (
    <div className="flex break-inside-avoid flex-col gap-2 rounded-lg border bg-white p-3 text-black">
      <div className="min-h-10">
        <p className="truncate font-semibold text-sm">{subject.name}</p>
        {subject.subtitle ? <p className="truncate text-neutral-600 text-xs">{subject.subtitle}</p> : null}
      </div>
      {/* biome-ignore lint/style/noNonNullAssertion: the list is filtered to subjects that have a payload */}
      <Barcode value={subject.attendance_qr!} height={52} />
      <p className="text-center font-mono text-[11px] text-neutral-700 tracking-wider">{subject.attendance_code}</p>
    </div>
  );
}
