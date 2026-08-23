export function formatPercentage(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const abs = Math.abs(value);

  if (abs >= 1000) {
    return `${(value / 1000).toFixed(2)}K%`;
  }

  return `${value.toFixed(2)}%`;
}

export function formatDateWithAge(
  date: string | null | undefined
): string {
  if (!date) {
    return "—";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  const formattedDate = parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  const now = new Date();

  let years = now.getFullYear() - parsedDate.getFullYear();

  const hasNotReachedAnniversary =
    now.getMonth() < parsedDate.getMonth() ||
    (now.getMonth() === parsedDate.getMonth() &&
      now.getDate() < parsedDate.getDate());

  if (hasNotReachedAnniversary) {
    years--;
  }

  // 1 year or more
  if (years >= 1) {
    return `${formattedDate} (about ${years} ${
      years === 1 ? "year" : "years"
    })`;
  }

  // Less than 1 year → calculate months
  let months =
    (now.getFullYear() - parsedDate.getFullYear()) * 12 +
    (now.getMonth() - parsedDate.getMonth());

  // Don't count the current month until its day has arrived
  if (now.getDate() < parsedDate.getDate()) {
    months--;
  }

  months = Math.max(0, months);

  if (months === 0) {
    return `${formattedDate} (less than a month)`;
  }

  return `${formattedDate} (about ${months} ${
    months === 1 ? "month" : "months"
  })`;
}