import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

export const Avatar = ({ className, ...p }: React.ComponentProps<typeof AvatarPrimitive.Root>) => (
  <AvatarPrimitive.Root className={cn("relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full", className)} {...p} />
);
export const AvatarFallback = ({ className, ...p }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) => (
  <AvatarPrimitive.Fallback className={cn("flex h-full w-full items-center justify-center rounded-full bg-primary-soft text-xs font-medium text-primary", className)} {...p} />
);
