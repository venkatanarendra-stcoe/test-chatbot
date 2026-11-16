import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const Overlay = () => (
  <D.Overlay className="fixed inset-0 z-50 bg-overlay/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
);
const CloseBtn = () => (
  <D.Close aria-label="Close" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <X className="h-4 w-4" />
  </D.Close>
);

export const DialogContent = ({ className, children, ...p }: React.ComponentProps<typeof D.Content>) => (
  <D.Portal>
    <Overlay />
    <D.Content
      className={cn("fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-surface p-5 shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:duration-150 data-[state=open]:duration-200", className)}
      {...p}
    >
      {children}<CloseBtn />
    </D.Content>
  </D.Portal>
);
export const DialogHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex flex-col gap-1 pr-8", className)} {...p} />;
export const DialogTitle = ({ className, ...p }: React.ComponentProps<typeof D.Title>) => <D.Title className={cn("text-section", className)} {...p} />;
export const DialogDescription = ({ className, ...p }: React.ComponentProps<typeof D.Description>) => <D.Description className={cn("text-sm text-text-secondary", className)} {...p} />;
