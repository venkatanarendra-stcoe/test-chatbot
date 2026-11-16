import * as React from "react";
import * as M from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;

export const DropdownMenuContent = ({ className, sideOffset = 6, ...p }: React.ComponentProps<typeof M.Content>) => (
  <M.Portal>
    <M.Content sideOffset={sideOffset} collisionPadding={8} className={cn("z-[70] min-w-[12rem] overflow-hidden rounded-xl border border-border bg-surface p-1 text-text shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95", className)} {...p} />
  </M.Portal>
);
export const DropdownMenuItem = ({ className, ...p }: React.ComponentProps<typeof M.Item>) => (
  <M.Item className={cn("relative flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 text-sm outline-none focus:bg-surface-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:stroke-[1.75] [&_svg]:text-text-muted", className)} {...p} />
);
export const DropdownMenuCheckboxItem = ({ className, children, ...p }: React.ComponentProps<typeof M.CheckboxItem>) => (
  <M.CheckboxItem className={cn("relative flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg pl-8 pr-2.5 text-sm outline-none focus:bg-surface-muted data-[disabled]:opacity-50", className)} {...p}>
    <span className="absolute left-2.5 flex h-4 w-4 items-center justify-center"><M.ItemIndicator><Check className="h-4 w-4 text-primary" /></M.ItemIndicator></span>
    {children}
  </M.CheckboxItem>
);
export const DropdownMenuLabel = ({ className, ...p }: React.ComponentProps<typeof M.Label>) => <M.Label className={cn("px-2.5 py-1.5 text-xs font-medium text-text-muted", className)} {...p} />;
export const DropdownMenuSeparator = ({ className, ...p }: React.ComponentProps<typeof M.Separator>) => <M.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...p} />;
