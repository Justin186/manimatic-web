import * as React from "react";

import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";

/**
 * 图标按钮。
 *
 * 存在的理由很实际：这个动作原先在 TopBar / ArtifactPanel / RenderProgress / Dialog 关闭键
 * 等 10 多处被**手写重复**了一遍（`grid place-items-center rounded-md text-ink-soft …`）。
 * 手写十遍就一定会漂移 —— 尺寸、圆角、hover 底色各自长一点差别，
 * 看起来就是"拼起来的"。
 *
 * ⚠️ `label` 是**必填**：纯图标按钮没有可读文本，漏了 aria-label 就是无障碍缺口。
 *    把它做成必填参数，比在 code review 里靠人盯可靠。
 */
export function IconButton({
  label,
  active,
  className,
  children,
  size = "md",
  variant = "plain",
  ...props
}: Omit<ButtonProps, "size" | "variant" | "aria-label"> & {
  /** 无障碍名称，会写到 aria-label */
  label: string;
  /** 当前处于"已激活"状态（如左右栏已展开） */
  active?: boolean;
  size?: "sm" | "md";
  /** plain = 无底色（默认）；soft = 常态就带一层品牌淡底 */
  variant?: "plain" | "soft";
}) {
  return (
    <Button
      variant="ghost"
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "p-0",
        size === "sm" ? "h-7 w-7" : "h-9 w-9",
        active && "bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent",
        !active && variant === "soft" && "bg-surface-2",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
