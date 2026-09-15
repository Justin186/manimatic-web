"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 分段选择。
 *
 * 设置页的四组胶囊、侧栏多选工具条、产物面板的 Tabs 本来是同一类东西（"一组里选一个"），
 * 却各写了一套 —— 于是圆角、选中底色、文字颜色三处都不一样。这里收成一个。
 *
 * 选中项用**白色卡片面 + 一级投影**（`bg-surface shadow-card`）而不是品牌色填充：
 * 分段控件常出现在已经有品牌色的卡片里，再来一块实心品牌色会打架。
 *
 * ⚠️ 这里只做**单选**。多选（设置页的科目）不能用它 —— 把多选硬塞进单选控件，
 *    用户看到"选了一个另一个就灭了"只会以为是 bug。
 *    多选场景请复用下面导出的两个样式常量，保持外观一致但语义正确：
 *
 * ```tsx
 * <div className={SEGMENTED_GROUP}>
 *   {list.map((s) => (
 *     <button key={s} aria-pressed={on} className={segmentItemClass(on, "sm")} … />
 *   ))}
 * </div>
 * ```
 */
export type SegmentedItem<T extends string> = {
  value: T;
  label: React.ReactNode;
  /** 悬浮提示，用于只有图标或短词的选项 */
  title?: string;
};

/** 分段控件的外壳：底色 + 内边距 + 内嵌圆角。多选组也用它，保证两组看起来是一套。 */
export const SEGMENTED_GROUP =
  "inline-flex flex-wrap items-center gap-0.5 rounded-control bg-surface-2 p-0.5";

/**
 * 单段的样式。
 * `on` 为真 = 选中态（白色卡片面 + 一级投影）。
 */
export function segmentItemClass(on: boolean, size: "sm" | "md" = "md") {
  return cn(
    "r-inset t-tx font-medium",
    size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
    on ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
  );
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
  label,
}: {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
  /** 整组的无障碍名称 */
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn(SEGMENTED_GROUP, className)}>
      {items.map((item) => {
        const on = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            title={item.title}
            aria-pressed={on}
            onClick={() => onChange(item.value)}
            className={segmentItemClass(on, size)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
