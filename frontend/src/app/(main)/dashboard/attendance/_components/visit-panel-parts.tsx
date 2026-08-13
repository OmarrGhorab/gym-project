import { format, parseISO } from "date-fns";

/**
 * The rows the desk reads a scan from — shared by the duplicate question and the
 * outcome that follows it, so the same membership never renders two ways.
 */
export function VisitDetailRow({ label, value }: { label: string; value: string }) {
  return (
    // minmax(0,1fr) lets the value column shrink instead of forcing the label
    // into a sliver; break-words handles names that are one long unbroken token.
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="break-words text-right font-medium">{value}</dd>
    </div>
  );
}

export function formatVisitDate(value: string) {
  const parsed = parseISO(value);

  // A malformed date must not blank the row the operator is deciding from.
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, "d MMM yyyy");
}

export function formatVisitTime(value: string) {
  const parsed = parseISO(value);

  return Number.isNaN(parsed.getTime()) ? value : format(parsed, "d MMM yyyy, HH:mm");
}
