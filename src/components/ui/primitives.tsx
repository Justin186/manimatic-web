import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 状态徽章。
 *
 * `tone` 的映射集中在**这一处**，好处是全站状态色不会各写一套 ——
 * 之前"同一个『渲染中』在三个组件里是三种颜色"就是这么来的。
 *
 * 六个 tone 各有明确语义，不要拿 `accent` 当万能强调色用：
 *   neutral 无状态 / 计数     accent 进行中（品牌色）
 *   accent2 次级信息（焦糖）  ok 已完成 / 成功
 *   warn 需要留意             err 失败 / 危险
 */
const BADGE_TONE = {
  neutral: "border-border bg-surface-2 text-fg-muted",
  accent: "border-transparent bg-accent-soft text-accent",
  accent2: "border-transparent bg-accent-2-soft text-accent-2",
  ok: "border-transparent bg-ok-soft text-ok",
  warn: "border-transparent bg-warn-soft text-warn",
  err: "border-transparent bg-err-soft text-err",
} as const;

export type BadgeTone = keyof typeof BADGE_TONE;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-xs font-medium",
        BADGE_TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("t-skeleton rounded-inner", className)} {...props} />;
}

/** 输入类控件共用的描边 / 焦点态，保证 Input 与 Textarea 手感一致 */
const FIELD = [
  "w-full border border-border bg-surface text-fg",
  "rounded-control",
  "placeholder:text-fg-subtle",
  "t-tx",
  "focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-focus",
  "disabled:opacity-60",
].join(" ");

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, "h-10 px-3 text-sm", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, "resize-none px-3 py-2 text-sm", className)} {...props} />;
}
