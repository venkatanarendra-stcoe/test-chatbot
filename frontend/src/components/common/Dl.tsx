import { cn } from "@/lib/utils";

/** Definition list: label above value, in a responsive grid. */
export function Dl({ items, cols = 2, className }: { items: [string, React.ReactNode][]; cols?: 1 | 2 | 3; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", cols === 1 && "grid-cols-1", cols === 2 && "grid-cols-1 sm:grid-cols-2", cols === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0"><dt className="text-xs font-medium text-text-muted">{k}</dt><dd className="mt-0.5 break-words text-sm tabular-nums text-text">{v}</dd></div>
      ))}
    </dl>
  );
}

/** Horizontal strip of key-value stats separated by dividers, inside one card body. */
export function StatStrip({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-3 xl:flex xl:bg-transparent xl:[&>div+div]:border-l xl:[&>div+div]:border-border">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0 bg-surface px-5 py-4 xl:flex-1"><dt className="text-xs font-medium text-text-muted">{k}</dt><dd className="mt-1 truncate text-section tabular-nums text-text">{v}</dd></div>
      ))}
    </dl>
  );
}
