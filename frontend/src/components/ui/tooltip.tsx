import * as React from "react";
import * as T from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = T.Provider;
export const Tooltip = T.Root;
export const TooltipTrigger = T.Trigger;
export const TooltipContent = ({ className, sideOffset = 6, ...p }: React.ComponentProps<typeof T.Content>) => (
  <T.Portal>
    <T.Content sideOffset={sideOffset} className={cn("z-[80] max-w-xs rounded-lg bg-text px-2.5 py-1.5 text-xs font-medium text-surface shadow-lg animate-in fade-in-0 zoom-in-95", className)} {...p} />
  </T.Portal>
);
