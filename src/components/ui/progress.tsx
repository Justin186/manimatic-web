"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

function Progress({
  className,
  value = 0,
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  return (
    <ProgressPrimitive.Root
      value={pct}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-line", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full bg-brick-600 transition-transform duration-300", indicatorClassName)}
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
