import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentProps<typeof ProgressPrimitive.Root> {
  variant?: "default" | "danger";
}

function Progress({
  className,
  value,
  variant = "default",
  ...props
}: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-3 w-full overflow-hidden rounded-full bg-white/30 backdrop-blur border border-border",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 rounded-full transition-all",
          variant === "danger"
            ? "bg-gradient-to-r from-red-500 to-red-300 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
            : "bg-gradient-to-r from-[var(--snail-green)] to-green-300 shadow-[0_0_10px_rgba(73,184,131,0.5)]"
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
