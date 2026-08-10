import { GYM_TIME_ZONE } from "@/lib/timezone";

export function formatDuration(minutes: number, locale = "en") {
  const numberFormatter = new Intl.NumberFormat(locale);

  if (minutes < 60) {
    return `${numberFormatter.format(minutes)}m`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest > 0
    ? `${numberFormatter.format(hours)}h ${numberFormatter.format(rest)}m`
    : `${numberFormatter.format(hours)}h`;
}

export function formatTime(value: string | null, locale = "en", fallback = "Not scanned") {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: GYM_TIME_ZONE,
  }).format(date);
}
