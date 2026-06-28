export function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatTime(value: string | null) {
  if (!value) {
    return "Not scanned";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not scanned";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
