const dateTime = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatWhen(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : "";
}

export function formatDuration(secs: number | null): string {
  if (secs === null) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

export function formatMoney(n: number | null): string {
  return n === null ? "" : `$${n.toLocaleString("en-CA")}`;
}
