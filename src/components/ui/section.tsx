import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 区块标题。
 *
 * 四级排版里的第三级（展示级 > 章节级 > 区块级 > 辅助说明）。
 * `display` 打开时标题走**展示级衬线**，只该用在落地页与空态这类"品牌露脸"的位置；
 * 工作台内部一律用默认的功能级无衬线。
 */
export function SectionHeading({
  eyebrow,
  title,
  desc,
  display = false,
  className,
}: {
  /** 标题上方那行小字（英文标签 / 分类） */
  eyebrow?: string;
  title: React.ReactNode;
  desc?: React.ReactNode;
  display?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {eyebrow ? (
        <p className="tnum mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          {eyebrow}
        </p>
      ) : null}
      {/*
        `text-balance` 是标题的默认项，不是可选项：
        中文标题一旦贪心填满第一行，很容易只剩一个字掉到第二行（"…的动 / 画"）。
        balance 让两行尽量等宽，从根上避免这种孤字。
      */}
      <h2
        className={cn(
          "text-balance font-semibold tracking-tight text-fg",
          display ? "font-display text-3xl" : "font-heading text-lg",
        )}
      >
        {title}
      </h2>
      {desc ? (
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-fg-muted">{desc}</p>
      ) : null}
    </div>
  );
}

/**
 * 空态。
 *
 * ⚠️ 空态必须说清"本来就没有"还是"没连上" —— 这两件事在界面上长得一模一样，
 *    但用户该做的事完全不同（一个去提问，一个去检查后端）。
 *    所以 `desc` 不是装饰文案，它承担的是排查指引。
 */
export function EmptyState({
  icon,
  title,
  desc,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-6 text-center",
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-pill bg-surface-2 text-fg-subtle">
        {icon}
      </span>
      <p className="font-heading text-sm font-medium text-fg">{title}</p>
      {desc ? (
        <p className="max-w-56 text-xs leading-relaxed text-fg-muted">{desc}</p>
      ) : null}
      {action}
    </div>
  );
}
