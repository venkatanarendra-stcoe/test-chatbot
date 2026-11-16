const IST = "Asia/Kolkata";
const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** ₹10,00,000 (Indian digit grouping). */
export const inr = (n: number) => INR.format(n);

/** ₹1 Cr / ₹12.5 L compact form for large values. */
export function inrCompact(n: number): string {
  if (n >= 1e7) return `₹${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5)} L`;
  return inr(n);
}
const trim = (x: number) => String(Math.round(x * 100) / 100);

/** DD MMM YYYY in IST (accepts a date or a timestamp). */
export function dmy(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" && value.length === 10 ? new Date(`${value}T00:00:00+05:30`) : new Date(value);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: IST });
}

export const dateTimeIST = (value: string | Date) =>
  new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: IST, hour12: true }) + " IST";

export const timeIST = (value: string | Date) =>
  new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: IST, hour12: true });

export const todayIST = () =>
  new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: IST });

export function greeting(): string {
  const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: IST }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

export type Group = "Today" | "Previous 7 days" | "Older";
export function groupOf(iso: string): Group {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: IST });
  if (day(new Date(iso)) === day(new Date())) return "Today";
  return (Date.now() - new Date(iso).getTime()) / 86_400_000 <= 7 ? "Previous 7 days" : "Older";
}

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: IST });

/** "Today", "Yesterday" or "12 Oct 2026" (IST) for chat date separators. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return dmy(d);
}
export const sameDay = (a: string, b: string) => dayKey(new Date(a)) === dayKey(new Date(b));

/** "just now", "5m ago", "3h ago", "4d ago", else a date. */
export function relativeTime(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d ago`;
  return dmy(iso);
}
