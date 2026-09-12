"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/primitives";
import { buildTimeline } from "@/lib/timeline";
import type { SceneRender } from "@/lib/types";

import { VideoPlayer } from "./VideoPlayer";

type Props = {
  scenes: SceneRender[];
  /** 大纲里的分镜总数（含未就绪的） */
  total: number;
  /** 打开右栏的产物详情（分镜列表、信息都在那边） */
  onOpenDetail: (index?: number) => void;
  /** 换消息时重置播放头 */
  resetKey?: string;
  finalUrl?: string;
  /** 播放器左上角显示的标题；调用方应与右栏产物卡片用同一个推导 */
  title?: string;
};

/**
 * 对话流内联卡片。
 *
 * 播放本身完全交给共用的 `VideoPlayer`（与右栏详情、全屏是同一套控件）；
 * 这里只负责"卡片外壳"：状态徽标 + 一个显眼的进详情入口。
 *
 * ⚠️ 内联卡片必须能让浏览器自动播放 —— 由 `VideoPlayer` 的 `inline` 形态负责静音，
 * 这不是 bug，是浏览器的 autoplay 策略。
 */
export function VideoSegmentCard({ scenes, total, onOpenDetail, resetKey, finalUrl, title }: Props) {
  // 用与播放器同一份时间轴取就绪数，避免两处口径不一致
  const timeline = useMemo(() => buildTimeline(scenes), [scenes]);
  const ready = timeline.readyCount;
  const done = ready >= total;

  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-surface">
      <VideoPlayer
        scenes={scenes}
        total={total}
        resetKey={resetKey}
        variant="inline"
        finalUrl={finalUrl}
        title={title ?? "讲解视频"}
        onOpenDetail={() => onOpenDetail()}
      />

      {/*
        底部只留状态 + 进详情的入口。
        总时长不在这里重复 —— 播放器控件层里已经有 `当前 / 全长` 了。
      */}
      <figcaption className="flex items-center gap-2 px-3 py-2">
        <Badge tone={done ? "ok" : "info"}>
          {done ? `已出片 · ${total} 个分镜` : `渲染中 · ${ready}/${total} 分镜就绪`}
        </Badge>
        <button
          type="button"
          onClick={() => onOpenDetail()}
          className="ml-auto flex shrink-0 items-center gap-0.5 text-xs text-ink-soft transition-colors hover:text-navy-900"
        >
          分镜与详情
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </figcaption>
    </figure>
  );
}
