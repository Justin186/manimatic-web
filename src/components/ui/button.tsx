import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * 按钮。
 *
 * 变体只有六个，且**每个都对应一个明确的产品语义**，不再保留同义别名
 * （曾经同时存在 `primary` 与 `accent`、`subtle` 与 `ghost`，调用方随便挑一个，
 * 结果"组件不统一"有一部分就是自己造出来的）：
 *
 *   primary  主操作，一屏一个（确认生成、开始、保存）
 *   grad     需要品牌声量的那一处（Hero CTA、发送）—— 与 primary 的差别只在渐变
 *   outline  次要操作（取消、下载、新建）
 *   soft     低强度强调（深度思考、标签式动作）
 *   ghost    几乎无重量（关闭、返回、次要链接式按钮）
 *   danger   不可逆操作（删除）
 *
 * 尺寸四档：sm 32 / md 40 / lg 48 / icon 40×40。
 * ⚠️ `icon` 必须与 `md` 同高（都是 40px）：同一个发送按钮在空态和对话态出现过两种高度，
 *    用户一眼就能看出"两处不一样大"（Composer 里有一段注释专门记着这个坑）。
 * ⚠️ 动效走 `t-tx` / `t-press` 两个工具类，而不是 `transition-colors`：
 *    全站按压回弹与过渡时长都收敛在那里，改一次全站一致。
 */
const buttonVariants = cva(
  [
    "t-tx t-press inline-flex select-none items-center justify-center gap-2 whitespace-nowrap",
    "rounded-control font-medium",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus",
    "disabled:pointer-events-none disabled:opacity-45",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg shadow-glow hover:bg-accent-hover",
        grad: "t-grad text-accent-fg shadow-glow hover:brightness-[1.08]",
        outline: "border border-border-strong bg-surface text-fg hover:bg-surface-2",
        soft: "bg-accent-soft text-accent hover:brightness-[0.97]",
        ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
        danger: "bg-err text-white hover:brightness-[1.08]",
      },
      size: {
        sm: "h-8 gap-1.5 px-3 text-xs",
        md: "h-10 gap-2 px-4 text-sm",
        lg: "h-12 gap-2 px-6 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
