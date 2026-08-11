/**
 * The gym runs in one place, so a scan at 18:20 must read as 18:20 for everyone
 * looking at it.
 *
 * Two runtimes format these dates. The browser sits in Egypt and gets it right
 * on its own; the Vercel Node runtime serving our Server Components sits in UTC
 * and, left to itself, renders every timestamp three hours behind. Pinning the
 * zone here settles it for both — and keeps a phone left on another timezone
 * from quietly showing its owner the wrong check-in times.
 *
 * Only for values that carry a real instant. A plain "YYYY-MM-DD" or a Date
 * built from parts (`new Date(2000, 0, 1, hour, minute)`) has no zone to convert
 * from, and forcing one on it shifts the day or the hour.
 */
export const GYM_TIME_ZONE = "Africa/Cairo";

/**
 * Today's calendar date at the gym, split into parts.
 *
 * `new Date()` in the UTC server runtime still reads yesterday until 03:00 in
 * Cairo — the whole tail of the night shift. Anything that asks the API for
 * "today", or builds a period that ends today, has to start from the gym's own
 * calendar or it silently reports the wrong day.
 */
export function getGymToday(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: GYM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value ?? "0");

  return { year: part("year"), month: part("month"), day: part("day") };
}

/**
 * Today at the gym as `YYYY-MM-DD`, ready to hand to the API.
 */
export function getGymTodayString(): string {
  const { year, month, day } = getGymToday();

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
