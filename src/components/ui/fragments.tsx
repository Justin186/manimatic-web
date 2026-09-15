"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/**
 * Tabs 只在产物详情里用到（分镜 / 信息两页）。
 * 下划线用品牌色，`-mb-px` 让下划线和容器那条 1px 描边压在一起 —— 否则会错开一个像素，
 * 看起来像两条线。
 */
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex items-center gap-1 border-b border-border", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "t-tx -mb-px border-b-2 border-transparent px-3 py-1.5 text-sm text-fg-muted",
        "hover:text-fg",
        "data-[state=active]:border-accent data-[state=active]:text-fg",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-3 focus:outline-none", className)}
      {...props}
    />
  );
}

/**
 * 头像。默认是**浅品牌色**底（`accent-soft` + 品牌色图标）。
 *
 * ⚠️ 这一档换过两次，别再来回改：
 *   · 最初是品牌**渐变**实心底 —— 对话流里助手每条消息都带一个头像，
 *     一屏十几个实心橙圆点，品牌色被稀释成了装饰。
 *   · 减橙时改成中性灰底 —— 又太"死"，看着像没上样式（未启用态）。
 *   · 现在是**浅填充**：面积还在，但只是 tints 一档，既保住助手的身份标记，
 *     也不会和"进行中/选中"这些真信号抢注意力。
 *     而且它和分镜大纲的序号胶囊是同一个色，两处标记天然成一套。
 *
 * 需要实心品牌底时由调用方显式传 `className="t-grad text-accent-fg"`。
 */
function Avatar({
  className,
  fallback,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & { fallback?: React.ReactNode }) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden",
        "rounded-pill bg-accent-soft text-xs font-medium text-accent",
        className,
      )}
      {...props}
    >
      <AvatarPrimitive.Fallback>{fallback ?? "?"}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, Avatar };
