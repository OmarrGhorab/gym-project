import { endOfMonth, format, parseISO, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";

export const REPORT_SCOPED_FILTER_KEYS = ["status", "category", "search", "payment_method", "group_by"] as const;

export type ReportQuickDate = 7 | 30 | "this_month" | "last_month" | "ytd";

export function normalizeReportDateRange(
  query: { from?: string; to?: string },
  today: string,
): { from: string; to: string } {
  const from = query.from?.trim();
  const to = query.to?.trim();

  return {
    from: from || to || today,
    to: to || from || today,
  };
}

export function getQuickReportDateRange(today: string, preset: ReportQuickDate): { from: string; to: string } {
  const currentDay = parseISO(today);
  let from = currentDay;
  let to = currentDay;

  if (typeof preset === "number") {
    from = subDays(currentDay, preset - 1);
  } else if (preset === "this_month") {
    from = startOfMonth(currentDay);
  } else if (preset === "last_month") {
    const previousMonth = subMonths(currentDay, 1);
    from = startOfMonth(previousMonth);
    to = endOfMonth(previousMonth);
  } else if (preset === "ytd") {
    from = startOfYear(currentDay);
  }

  return {
    from: format(from, "yyyy-MM-dd"),
    to: format(to, "yyyy-MM-dd"),
  };
}

export function buildReportTabParams(
  current: URLSearchParams,
  type: string,
  range: { from: string; to: string },
): URLSearchParams {
  const params = new URLSearchParams(current.toString());

  for (const key of REPORT_SCOPED_FILTER_KEYS) {
    params.delete(key);
  }

  params.set("type", type);
  params.set("from", range.from);
  params.set("to", range.to);

  return params;
}
