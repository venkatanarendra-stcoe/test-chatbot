import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;

const sheetVariants = cva(
  "fixed z-50 flex flex-col bg-surface shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-150 data-[state=open]:duration-200",
  {
    variants: {
      side: {
        left: "inset-y-0 left-0 h-full w-72 max-w-[85vw] border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        right: "inset-y-0 right-0 h-full w-full border-l border-border sm:max-w-[480px] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        bottom: "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t border-border data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
      },
    },
    defaultVariants: { side: "right" },
  },
);

export const SheetContent = ({ side, className, children, ...p }: React.ComponentProps<typeof D.Content> & VariantProps<typeof sheetVariants>) => (
  <D.Portal>
    <D.Overlay className="fixed inset-0 z-50 bg-overlay/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <D.Content className={cn(sheetVariants({ side }), className)} {...p}>
      {children}
      <D.Close aria-label="Close" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <X className="h-4 w-4" />
      </D.Close>
    </D.Content>
  </D.Portal>
);
export const SheetHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex flex-col gap-1 border-b border-border px-5 py-4 pr-14", className)} {...p} />;
export const SheetBody = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("min-h-0 flex-1 overflow-y-auto p-5 scrollbar-thin", className)} {...p} />;
export const SheetTitle = ({ className, ...p }: React.ComponentProps<typeof D.Title>) => <D.Title className={cn("text-section", className)} {...p} />;
export const SheetDescription = ({ className, ...p }: React.ComponentProps<typeof D.Description>) => <D.Description className={cn("text-sm text-text-secondary", className)} {...p} />;
