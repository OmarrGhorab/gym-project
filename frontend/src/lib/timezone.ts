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
