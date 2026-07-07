export function formatTimeRange12Hour(value: string, locale: string) {
  const [start, end] = value.split(/\s*-\s*/);

  if (!start || !end) {
    return value;
  }

  return `${formatTime12Hour(start, locale)} - ${formatTime12Hour(end, locale)}`;
}

export function formatTime12Hour(value: string, locale: string) {
  const [hourValue, minuteValue = "0"] = value.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hour, minute));
}
