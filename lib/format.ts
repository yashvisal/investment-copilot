export function usd(n: number | undefined | null): string {
  if (n === undefined || n === null) return "$0.00";
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

export function minutesRange([lo, hi]: readonly [number, number]): string {
  return `${lo}–${hi} min`;
}

export function elapsed(startedAt?: number, completedAt?: number, now: number = Date.now()): string {
  if (!startedAt) return "";
  const ms = (completedAt ?? now) - startedAt;
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem.toString().padStart(2, "0")}s`;
}

export function timeOfDay(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function dateShort(ts: number): string {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function hostname(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function millions(n: unknown): string {
  if (typeof n !== "number") return "—";
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}B` : `$${n}M`;
}
