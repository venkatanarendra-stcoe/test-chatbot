import { cn } from "@/lib/utils";

export const Separator = ({ className, orientation = "horizontal" }: { className?: string; orientation?: "horizontal" | "vertical" }) => (
  <div role="separator" aria-orientation={orientation} className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)} />
);
