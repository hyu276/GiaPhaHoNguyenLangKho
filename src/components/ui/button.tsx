/**
 * BUTTON_UI
 *
 * Purpose: Provides the repository-standard shadcn-compatible button presentation primitive.
 * Connections: Radix Slot, class variance authority, and shared class-name utilities.
 * Risk: Low because this primitive contains no domain or persistence behavior.
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-sm font-medium transition-[transform,opacity] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:opacity-95",
        secondary:
          "bg-secondary text-secondary-foreground hover:-translate-y-0.5 hover:opacity-90",
        outline:
          "border border-border bg-background text-foreground hover:opacity-80",
        ghost: "text-foreground hover:opacity-70",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-11 px-4",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
