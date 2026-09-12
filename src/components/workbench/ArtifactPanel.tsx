"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Film, Loader2, Play, Sparkles } from "lucide-react";

import { Badge, Separator } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/fragments";
import type { TimelinePlayerApi } from "@/lib/playback";
import { buildTimeline } from "@/lib/timeline";
import type { RenderState } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";

import { VideoPlayer } from "./VideoPlayer";

/** 一条会话里可以生成多个产物（每次"AI 改分镜"都会追加一条带 render 的消息） */
export type Artifact = {
  /** 指向所属消息，用于定位全屏播放目标 */
  messageId: string;
  /** 版本号（v1/v2/v3） */
  version: number;
  title: string;
  render: RenderState;
  createdAt: number;
};

type Props = {
  artifacts: Artifact[];
  /** 切换会话/新产物时重置 */
  resetKey?: string;
  /** 当前打开的产物详情 id（受控，由 Workbench 持有，内联卡片点「详情」要能定位过来） */
  activeId?: string | null;
  onActiveChange: (id: string | null) => void;
};

/** 相对时间：产物列表里时间只是辅助信息，不必精确到秒 */
function relative(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  return `${Math.floor(hr / 24)} 天前`;
}

function statusOf(render: RenderState) {
  if (render.status === "done") return { label: "已出片", tone: "ok" as const };
  if (render.status === "error") return { label: "有分镜失败", tone: "err" as const };
  if (render.status === "running") return { label: `渲染中 ${render.step}/${render.total}`, tone: "accent" as const };
  return { label: "排队中", tone: "neutral" as const };
}

/**
 * 右栏：产物列表 + 二级详情。
 *
 * 为什么改成两级：原来这里直接摊开"某一个产物的播放器 + 分镜列表"，和点开全屏几乎
 * 一样，而一条会话里通常有多个产物（每次修正生成一条新消息）—— 于是用户只能看到
 * 最后一个，前面的没法回看，也看不出这条会话一共出过几版。
 *
 * 现在一级只给缩略图列表（看得见"生成了哪些"），点进去才是二级详情（观看 + 分镜 + 信息）。
 */
export function ArtifactPanel({ artifacts, resetKey, activeId, onActiveChange }: Props) {
  const active = useMemo(
    () => artifacts.find((a) => a.messageId === activeId) ?? null,
    [artifacts, activeId],
  );

  // 切换会话时回到列表：否则会停在上一条会话的详情里，产生"串台"的错觉
  useEffect(() => {
    onActiveChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // 产物被删/被换掉（如重新生成）时，避免详情停在已经不存在的产物上
  useEffect(() => {
    if (activeId && !active) onActiveChange(null);
  }, [activeId, active, onActiveChange]);

  if (artifacts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-canvas text-ink-soft">
          <Film className="h-6 w-6" />
        </span>
        <p className="font-serif-cn text-sm text-navy-900">还没有成片</p>
        <p className="max-w-56 text-xs leading-relaxed text-ink-soft">
          确认分镜大纲后开始渲染，这里会列出这条对话生成过的每一版讲解视频。
        </p>
      </div>
    );
  }

  if (active) {
    return <ArtifactDetail artifact={active} onBack={() => onActiveChange(null)} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <Film className="h-4 w-4 text-brick-600" />
        <span className="font-serif-cn text-sm font-semibold text-navy-900">产物</span>
        <span className="tnum text-xs text-ink-soft">{artifacts.length} 个视频</span>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="space-y-2">
          {artifacts.map((a) => {
            const timeline = buildTimeline(a.render.scenes);
            const status = statusOf(a.render);
            const cover = a.render.scenes.find((s) => s.url)?.url;
            const running = a.render.status === "running";

            return (
              <li key={a.messageId}>
                <button
                  onClick={() => onActiveChange(a.messageId)}
                  className="group w-full overflow-hidden rounded-lg border border-line bg-surface text-left transition-colors hover:border-navy-900/25"
                >
                  {/* 缩略图：直接拿第一段 mp4 当封面（`#t` 让它停在第一帧，不自动播） */}
                  <span className="relative block aspect-video w-full overflow-hidden bg-navy-950">
                    {cover ? (
                      <video
                        src={`${cover}#t=0.1`}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="grid h-full place-items-center text-white/40">
                        {running ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Film className="h-5 w-5" />
                        )}
                      </span>
                    )}

                    {/* 悬停时浮出的播放提示 —— 明确"点进去才能看" */}
                    <span className="absolute inset-0 grid place-items-center bg-navy-950/35 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-navy-950/70 text-white backdrop-blur">
                        <Play className="ml-0.5 h-4.5 w-4.5" />
                      </span>
                    </span>

                    <span className="tnum absolute bottom-1.5 right-1.5 rounded bg-navy-950/70 px-1.5 py-0.5 text-xs text-white/90">
                      {formatDuration(timeline.total)}
                    </span>
                    <span className="absolute left-1.5 top-1.5 rounded bg-navy-950/70 px-1.5 py-0.5 text-xs text-white/90">
                      v{a.version}
                    </span>
                  </span>

                  <span className="block px-2.5 py-2">
                    <span className="block truncate text-sm text-navy-900">{a.title}</span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span className="tnum text-xs text-ink-soft">
                        {a.render.total} 分镜
                      </span>
                      {/*
                        相对时间依赖 `Date.now()`，服务端渲染与客户端 hydration
                        之间可能跨过"1 分钟/1 小时"的边界而算出不同文字。
                        这是 React 官方的 hydration 豁免场景，标记一下即可
                        （不标记的话日志里就是一条 "server rendered HTML didn't match"）。
                      */}
                      <span className="ml-auto text-xs text-ink-soft" suppressHydrationWarning>
                        {relative(a.createdAt)}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- 二级：单个产物的详情 ---------------- */

function ArtifactDetail({ artifact, onBack }: { artifact: Artifact; onBack: () => void }) {
  const { render } = artifact;
  const timeline = useMemo(() => buildTimeline(render.scenes), [render.scenes]);
  const status = statusOf(render);

  /**
   * 播放器句柄。
   *
   * 分镜列表要能"点了就跳到那一段"，而播放状态在播放器内部 ——
   * 所以由播放器把句柄交出来，详情页的分镜列表直接调 `seekToScene`，
   * 而不是像以前那样"点分镜 → 弹全屏"。观看本来就在这个播放器里。
   */
  const [player, setPlayer] = useState<TimelinePlayerApi | null>(null);
  const playing = player?.playing ?? false;

  return (
    <div className="anim-rise flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-2.5 py-2">
        <button
          onClick={onBack}
          aria-label="返回产物列表"
          className="grid h-7 w-7 shrink-0 place-items-center rounded text-ink-soft transition-colors hover:bg-canvas hover:text-navy-900"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="min-w-0 flex-1 truncate font-serif-cn text-sm font-semibold text-navy-900">
          {artifact.title}
        </span>
        <span className="shrink-0 text-xs text-ink-soft">v{artifact.version}</span>
      </div>

      <VideoPlayer
        scenes={render.scenes}
        total={render.total}
        resetKey={artifact.messageId}
        variant="panel"
        finalUrl={render.finalUrl}
        title={artifact.title}
        onPlayerReady={setPlayer}
      />

      <div className="flex items-center gap-2 px-3 py-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="tnum ml-auto text-xs text-ink-soft">
          {timeline.readyCount}/{render.total} 段 · {formatDuration(timeline.total)}
        </span>
      </div>

      <Separator />

      <Tabs defaultValue="scenes" className="flex min-h-0 flex-1 flex-col px-3">
        <TabsList>
          <TabsTrigger value="scenes">分镜</TabsTrigger>
          <TabsTrigger value="info">信息</TabsTrigger>
        </TabsList>

        <TabsContent value="scenes" className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-3">
          <ul className="space-y-1">
            {timeline.slots.map((slot) => (
              <li key={slot.index}>
                <button
                  // 点了就跳到那一段（在当前播放器里看），不再弹全屏
                  onClick={() => player?.seekToScene(slot.index)}
                  disabled={slot.state !== "ready"}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    slot.state === "ready" ? "hover:bg-canvas" : "cursor-not-allowed opacity-60",
                  )}
                >
                  <span className="tnum w-4 shrink-0 text-ink-soft">{slot.index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-navy-900">{slot.title}</span>
                  {slot.state === "ready" ? (
                    <span className="tnum text-ink-soft">{formatDuration(slot.duration)}</span>
                  ) : slot.state === "failed" ? (
                    <Badge tone="err">失败</Badge>
                  ) : (
                    <Badge>未就绪</Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="info" className="pb-3 text-xs leading-relaxed text-ink-soft">
          <dl className="space-y-1.5">
            <div className="flex justify-between">
              <dt>分镜数</dt>
              <dd className="tnum text-navy-900">{render.total}</dd>
            </div>
            <div className="flex justify-between">
              <dt>总时长</dt>
              <dd className="tnum text-navy-900">{formatDuration(timeline.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>状态</dt>
              <dd className="text-navy-900">{playing ? "播放中" : status.label}</dd>
            </div>
          </dl>
          <p className="mt-3 flex gap-1.5 rounded bg-canvas px-2 py-1.5">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-brick-600" />
            分镜按顺序渲染，渲好一段就点亮一段、自动续播。每段时长用的是渲染后的真实帧时长，
            不是大纲里的估算值 —— 所以进度条和分镜定位不会漂。
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
