import * as React from "react";
import { ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { cn } from "@/lib/utils";

/** Chart palette as theme-aware CSS colors, in order. */
export const CHART_COLORS = [1, 2, 3, 4, 5, 6].map((i) => `rgb(var(--chart-${i}))`);

export function ChartContainer({ className, children }: { className?: string; children: React.ReactElement }) {
  return (
    <div className={cn("h-full min-h-0 w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-text-muted [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-text]:text-xs", className)}>
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  );
}

interface TipProps { active?: boolean; payload?: { name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }[]; label?: string }
export function ChartTooltipContent({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-medium text-text">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color || (p.payload?.fill as string) }} />
          <span className="text-text-secondary">{p.name ?? (p.payload?.name as string)}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums text-text">{p.value}</span>
        </p>
      ))}
    </div>
  );
}
export const ChartTooltip = (props: React.ComponentProps<typeof RTooltip>) => <RTooltip cursor={{ fill: "rgb(var(--surface-muted) / 0.7)" }} content={<ChartTooltipContent />} {...props} />;
