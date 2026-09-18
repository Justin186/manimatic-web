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

/**
 * 开关的**外观**（滑轨 + 滑块），不含任何交互。
 *
 * ⚠️ 为什么要把它和 `Switch` 拆开：有些地方整个设置行都该能点
 *    （弹性区域大、触摸设备上好按），那一行的正确做法是
 *    `<button role="switch">大块文字 + 这个视觉</button>` ——
 *    而不是"一个按钮里再嵌一个按钮"，那是非法的 HTML，
 *    键盘 Tab 会在同一个开关上停两次，读屏会念出两个控件。
 *    所以把"长什么样"放在这里，由调用方决定"谁是可交互元素"。
 */
export function SwitchVisual({
  checked,
  disabled,
  className,
}: {
  checked: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        // 滑轨 36×20，圆角走 pill。开=品牌实心，关=描边面色。
        "t-tx relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill border",
        checked ? "border-transparent bg-accent" : "border-border-strong bg-surface-2",
        disabled ? "opacity-50" : "",
        className,
      )}
    >
      <span
        className={cn(
          // 滑块位移用 transform，走 GPU；`left-*` 会触发重排，动画会掉帧
          "t-tx pointer-events-none block h-3.5 w-3.5 rounded-pill bg-surface shadow-card",
          "translate-x-[3px]",
          checked && "translate-x-[19px]",
        )}
      />
    </span>
  );
}

/**
 * 开关（独立控件形态）。
 *
 * ⚠️ 用**原生 `<button role="switch">`** 而不是引入 `@radix-ui/react-switch`：
 *    项目已经装了十来个 Radix 包，但为这一个开关再加一个依赖，换来的只是
 *    "免写十几行" —— 而开关本身没有浮层、没有焦点陷阱、没有 portal，
 *    Radix 那套能力一个都用不上。原生按钮 + aria-checked 就是完整的语义。
 *
 * ⚠️ 必须是 `<button>` 而不是一个可点的 div：键盘 Tab 能聚焦、空格能切换、
 *    读屏能念出"开关，已打开"，这些全部来自元素本身而不是样式。
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** 无障碍名称（视觉上旁边的文案不参与关联，必须显式给） */
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "shrink-0 rounded-pill",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <SwitchVisual checked={checked} disabled={disabled} />
    </button>
  );
}
