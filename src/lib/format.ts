const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Formats an ISO date string ("2024-11-28") for display.
 * Pinned to en-US + UTC so output is identical on every machine — demo data
 * and tests rely on deterministic rendering.
 */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
