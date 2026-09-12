import * as React from "react";

import { cn } from "@/lib/utils";

/** 状态徽章：分镜/任务的状态色都走这里，避免各组件各写一套颜色 */
const badgeVariants: Record<string, string> = {
  neutral: "bg-canvas text-navy-700 border-line",
  info: "bg-navy-900/5 text-navy-900 border-navy-900/15",
  accent: "bg-brick-100 text-brick-700 border-brick-600/25",
  ok: "bg-ok-600/10 text-ok-600 border-ok-600/25",
  warn: "bg-warn-600/10 text-warn-600 border-warn-600/25",
  err: "bg-err-600/10 text-err-600 border-err-600/25",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeVariants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        badgeVariants[tone] ?? badgeVariants.neutral,
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
        "shrink-0 bg-line",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded bg-line/70", className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-navy-900 placeholder:text-ink-soft/70 focus:border-brick-600 focus:outline-none focus:ring-2 focus:ring-brick-600/25",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-navy-900 placeholder:text-ink-soft/70 focus:border-brick-600 focus:outline-none focus:ring-2 focus:ring-brick-600/25",
        className,
      )}
      {...props}
    />
  );
}
