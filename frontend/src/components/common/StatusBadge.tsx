import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const TONES: Record<string, Tone> = {
  active: "success", approved: "success", settled: "success", success: "success", allowed: "success", online: "success",
  "grace period": "warning", pending: "warning", submitted: "warning", "under review": "warning", "documents pending": "warning", flagged: "warning",
  lapsed: "danger", rejected: "danger", failed: "danger", denied: "danger", blocked: "danger", offline: "danger",
  expired: "neutral", none: "neutral",
};

const STYLE: Record<Tone, { badge: string; dot: string }> = {
  success: { badge: "bg-success-bg text-success", dot: "bg-success" },
  warning: { badge: "bg-warning-bg text-warning", dot: "bg-warning" },
  danger: { badge: "bg-danger-bg text-danger", dot: "bg-danger" },
  neutral: { badge: "bg-neutral-bg text-neutral", dot: "bg-neutral" },
  info: { badge: "bg-info-bg text-info", dot: "bg-info" },
};

export const toneOf = (status: string): Tone => TONES[status.toLowerCase()] ?? "neutral";

/** One pill badge for every status in the app: 12px medium text with a 6px leading dot. */
export function StatusBadge({ status, tone, className }: { status: string; tone?: Tone; className?: string }) {
  const s = STYLE[tone ?? toneOf(status)];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", s.badge, className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.dot)} aria-hidden />{status}
    </span>
  );
}

/** Tag-style info pill (links, tags). */
export function InfoTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full bg-info-bg px-2 py-0.5 text-xs font-medium text-info", className)}>{children}</span>;
}
