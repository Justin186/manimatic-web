"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

/**
 * 进度条。
 *
 * 两处刻意设计：
 * 1. **指示条用品牌渐变**，并在渲染中叠一道流动光泽（`.t-flow`）——
 *    这个产品的等待时间以十秒计，"还在动"必须可见，否则用户会以为卡死。
 *    光泽由 CSS 动画驱动，不触发 React 重渲染。
 * 2. **轨道用 surface-3**（比页面底深一档）。曾经用过描边的浅灰，
 *    在白色卡片上几乎看不见轨道，剩下的进度条读不出"总共多长"。
 *
 * `.t-flow` 里的涟漪在 `prefers-reduced-motion` 下会随全局规则一起降级为静止。
 */
function Progress({
  className,
  value = 0,
  flowing = true,
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
  /** 静止的进度条（例如已完成的产物）不必再流动 */
  flowing?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  return (
    <ProgressPrimitive.Root
      value={pct}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-pill bg-surface-3",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "t-grad relative h-full overflow-hidden rounded-pill transition-transform duration-300 ease-out",
          flowing && "t-flow",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
