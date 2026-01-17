import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[2rem_1.1rem_2rem_1.1rem] px-5 py-2 text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-transparent focus-visible:ring-[3px] focus-visible:ring-white/40 shadow-[0_8px_24px_rgba(23,19,32,0.25)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--snail-green)] text-white hover:bg-[var(--snail-green)]/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-white/50 bg-white/30 backdrop-blur hover:bg-white/50 text-foreground",
        secondary:
          "bg-white/40 text-foreground hover:bg-white/60",
        ghost:
          "bg-transparent text-foreground hover:bg-white/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 has-[>svg]:px-4",
        sm: "h-9 gap-1.5 px-4",
        lg: "h-12 px-7",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
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
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
