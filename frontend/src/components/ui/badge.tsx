import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium transition-colors", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      secondary: "bg-surface-muted text-text-secondary",
      outline: "border-border text-text-secondary",
      success: "bg-success-bg text-success",
      warning: "bg-warning-bg text-warning",
      destructive: "bg-danger-bg text-danger",
      info: "bg-info-bg text-info",
      muted: "bg-neutral-bg text-neutral",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
