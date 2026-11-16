import * as React from "react";
import * as T from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export const TabsList = ({ className, ...p }: React.ComponentProps<typeof T.List>) => (
  <T.List className={cn("flex h-10 items-end gap-1 overflow-x-auto border-b border-border scrollbar-thin", className)} {...p} />
);
export const TabsTrigger = ({ className, ...p }: React.ComponentProps<typeof T.Trigger>) => (
  <T.Trigger className={cn("-mb-px inline-flex h-10 items-center whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-primary", className)} {...p} />
);
export const TabsContent = ({ className, ...p }: React.ComponentProps<typeof T.Content>) => (
  <T.Content className={cn("focus-visible:outline-none", className)} {...p} />
);
