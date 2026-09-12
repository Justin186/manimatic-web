"use client";

import { useCallback, useRef, useState } from "react";

import type { SlotState, Timeline } from "@/lib/timeline";
import { cn, formatDuration } from "@/lib/utils";

type Props = {
  timeline: Timeline;
  /** 整片全局进度（秒） */
  globalTime: number;
  /** 当前所在分镜序号，用于高亮它左侧的刻度 */
  currentIndex?: number | null;
  onSeek: (globalTime: number) => void;
  /**
   * 是否在轨道右侧显示行内时间文字，默认显示。
   *
   * 播放器的控件层里传 `false`：底行已经有一处 `0:12 / 0:36` 了，
   * 两处并排就是重复信息。
   */
  showTime?: boolean;
  /**
   * 深色模式：播放器控件层（视频画面之上）用。
   * 轨道、刻度、把手都要换成能在深色画面上看清的配色 —— 浅色主题的
   * `bg-line` 轨道压在视频上几乎等于隐形。
   */
  tone?: "light" | "dark";
};

const STRIPE_LIGHT: Record<SlotState, string> = {
  ready: "bg-navy-300/40",
  pending: "bg-canvas",
  failed: "bg-err-600/25",
};

const STRIPE_DARK: Record<SlotState, string> = {
  ready: "bg-white/25",
  pending: "bg-white/10",
  failed: "bg-err-600/45",
};

const STRIPE_IMAGE =
  "repeating-linear-gradient(45deg, var(--color-line) 0 2px, transparent 2px 8px)";

const STRIPE_IMAGE_DARK =
  "repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 2px, transparent 2px 8px)";

/**
 * 整片进度条。
 *
 * 轨道按分镜时长比例铺格，三态各有底色；已播部分用砖橙覆盖，并画分镜边界刻度。
 *
 * 关键点：拖拽时只改本地预览时间（不 seek），松手才回调 —— 避免每帧切 `src` 造成卡顿。
 * 播放中的平滑推进由 `useTimelinePlayer` 的 rAF 保证（原生 `timeupdate` 只有 ~4Hz，
 * 直接用它会让进度条一跳一跳）。
 *
 * 目前只服务于播放器控件层（`tone="dark"`）；浅色主题保留给需要"页面内嵌进度条"的场景。
 */
export function TimelineScrubber({
  timeline,
  globalTime,
  currentIndex,
  onSeek,
  showTime = true,
  tone = "light",
}: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragTime, setDragTime] = useState<number | null>(null);

  const dark = tone === "dark";
  const stripe = dark ? STRIPE_DARK : STRIPE_LIGHT;

  const total = timeline.total;
  const noReady = timeline.readyCount === 0;
  const shown = dragTime ?? globalTime;
  const ratio = total > 0 ? Math.min(Math.max(shown / total, 0), 1) : 0;
  const percent = ratio * 100;
  const at = (t: number) => (total > 0 ? `${Math.min(Math.max(t / total, 0), 1) * 100}%` : "0%");

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || total <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const r = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      return r * total;
    },
    [total],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (noReady) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragTime(timeFromClientX(e.clientX));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragTime === null) return;
    setDragTime(timeFromClientX(e.clientX));
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragTime === null) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragTime(null);
    onSeek(dragTime);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (noReady) return;
    const step = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSeek(shown - step);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onSeek(shown + step);
    } else if (e.key === "Home") {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onSeek(total);
    }
  };

  const dragging = dragTime !== null;

  return (
    <div className="flex items-center gap-2">
      <div
        ref={trackRef}
        role="slider"
        aria-label="整片进度"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(shown)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onKeyDown={onKeyDown}
        className={cn(
          "group relative h-1.5 flex-1 touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brick-600/40",
          // 深色模式把轨道提亮：压在视频画面上太暗会看不清也点不准
          dark ? "bg-white/25" : "bg-line",
          noReady ? "cursor-not-allowed opacity-55" : "cursor-pointer",
        )}
      >
        {/* 每一格的三态底色 */}
        {timeline.slots.map((s) => (
          <span
            key={s.index}
            className={cn("absolute inset-y-0", stripe[s.state])}
            style={{
              left: at(s.start),
              width: at(s.duration),
              backgroundImage: s.state === "pending" ? (dark ? STRIPE_IMAGE_DARK : STRIPE_IMAGE) : undefined,
            }}
          />
        ))}

        {/*
          已播填充。
          ⚠️ 这里**故意不加 transition**：进度现在由 rAF 按 ~60fps 更新，
          再叠一层 150ms 的 CSS 补间反而不跟手（看起来像"追不上"的拖影）。
          拖拽时本来也是 transition-none，现在统一成"永远直接跟随"。
        */}
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-brick-600"
          style={{ width: `${percent}%` }}
        />

        {/* 分镜边界刻度 */}
        {timeline.slots.slice(1).map((s) => (
          <span
            key={`edge-${s.index}`}
            className={cn(
              "absolute inset-y-0 w-px",
              dark
                ? currentIndex === s.index
                  ? "bg-white/70"
                  : "bg-white/30"
                : currentIndex === s.index
                  ? "bg-navy-900"
                  : "bg-navy-900/25",
            )}
            style={{ left: at(s.start) }}
          />
        ))}

        {/* 把手：深色模式用白底，浅色模式用藏青描边。left 同样不加过渡，避免追不上 */}
        {!noReady && (
          <span
            className={cn(
              "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm",
              dark ? "border-white bg-navy-900" : "border-navy-900 bg-white",
              dragging ? "h-3.5 w-3.5 scale-125" : "h-3.5 w-3.5 group-hover:scale-110",
            )}
            style={{ left: `${percent}%` }}
          />
        )}

        {/* 拖拽中的时间气泡 */}
        {dragging && (
          <span
            className="tnum pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-navy-900 px-1.5 py-0.5 text-xs text-white shadow"
            style={{ left: `${percent}%` }}
          >
            {formatDuration(shown)}
          </span>
        )}
      </div>

      {showTime && (
        <span className={cn("tnum shrink-0 text-xs", dark ? "text-white/75" : "text-ink-soft")}>
          {noReady ? "正在渲染第一个分镜…" : `${formatDuration(shown)} / ${formatDuration(total)}`}
        </span>
      )}
    </div>
  );
}
