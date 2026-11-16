import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover",
        destructive: "bg-danger text-surface shadow-xs hover:opacity-90",
        outline: "border border-border bg-surface text-text shadow-xs hover:bg-surface-muted",
        secondary: "border border-border bg-surface text-text shadow-xs hover:bg-surface-muted",
        ghost: "text-text-secondary hover:bg-surface-muted hover:text-text",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: { default: "h-9 px-3.5 max-md:h-10", sm: "h-8 px-3 max-md:h-10", lg: "h-10 px-4", icon: "h-8 w-8 max-md:h-10 max-md:w-10" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
