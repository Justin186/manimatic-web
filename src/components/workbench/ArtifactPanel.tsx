"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Film, Loader2, Play, Sparkles } from "lucide-react";

import { Badge, Separator, type BadgeTone } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/fragments";
import { IconButton } from "@/components/ui/icon-button";
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
  /**
   * 会话 id + 画廊状态，透传给详情页的播放器（它的控件层有分享按钮）。
   *
   * ⚠️ 全部可选：右栏不传时分享弹窗退化成"只展示链接 + 下载"，
   *    行为与改造前一致 —— 这样这个组件在别的上下文里复用也不会坏。
   */
  threadId?: string;
  published?: boolean;
  onPublishedChange?: (on: boolean) => void;
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

function statusOf(render: RenderState): { label: string; tone: BadgeTone } {
  if (render.status === "done") return { label: "已出片", tone: "ok" };
  if (render.status === "error") return { label: "有分镜失败", tone: "err" };
  if (render.status === "running")
    return { label: `渲染中 ${render.step}/${render.total}`, tone: "accent" };
  return { label: "排队中", tone: "neutral" };
}

/**
 * 右栏：产物列表 + 二级详情。
 *
 * 为什么是两级：原来这里直接摊开"某一个产物的播放器 + 分镜列表"，和点开全屏几乎
 * 一样，而一条会话里通常有多个产物（每次修正生成一条新消息）—— 于是用户只能看到
 * 最后一个，前面的没法回看，也看不出这条会话一共出过几版。
 *
 * 现在一级只给缩略图列表（看得见"生成了哪些"），点进去才是二级详情（观看 + 分镜 + 信息）。
 */
export function ArtifactPanel({
  artifacts,
  resetKey,
  activeId,
  onActiveChange,
  threadId,
  published,
  onPublishedChange,
}: Props) {
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
      <EmptyState
        className="h-full"
        icon={<Film className="h-6 w-6" />}
        title="还没有成片"
        desc="确认分镜大纲后开始渲染，这里会列出这条对话生成过的每一版讲解视频。"
      />
    );
  }

  if (active) {
    return (
      <ArtifactDetail
        artifact={active}
        onBack={() => onActiveChange(null)}
        threadId={threadId}
        published={published}
        onPublishedChange={onPublishedChange}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Film className="h-4 w-4 text-fg-muted" />
        <span className="font-heading text-sm font-semibold text-fg">产物</span>
        <span className="tnum text-xs text-fg-subtle">{artifacts.length} 个视频</span>
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
                  className={cn(
                    "t-lift group w-full overflow-hidden rounded-inner border border-border bg-surface text-left shadow-card",
                    "hover:border-accent/40",
                  )}
                >
                  {/* 缩略图：直接拿第一段 mp4 当封面（`#t` 让它停在第一帧，不自动播） */}
                  <span className="relative block aspect-video w-full overflow-hidden bg-video">
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

                    {/* 悬停时浮出的播放提示 —— 明确"点进去才能看"。
                        这里的三角是**实心**的（`fill-current`）：它是画面上的一个"大动作"提示，
                        描边版在 16px 下只会糊成一小圈轮廓。控件层里那些播放/暂停键则保持描边，
                        与其余控件统一。 */}
                    <span className="absolute inset-0 grid place-items-center bg-scrim opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="grid h-10 w-10 place-items-center rounded-pill bg-black/70 text-white backdrop-blur">
                        <Play className="ml-0.5 h-4 w-4 fill-current" />
                      </span>
                    </span>

                    <span className="tnum absolute bottom-1.5 right-1.5 rounded-pill bg-black/65 px-1.5 py-0.5 text-xs text-white/90">
                      {formatDuration(timeline.total)}
                    </span>
                    <span className="tnum absolute left-1.5 top-1.5 rounded-pill bg-black/65 px-1.5 py-0.5 text-xs text-white/90">
                      v{a.version}
                    </span>
                  </span>

                  <span className="block px-2.5 py-2">
                    <span className="block truncate text-sm text-fg">{a.title}</span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <span className="tnum text-xs text-fg-subtle">{a.render.total} 分镜</span>
                      {/*
                        相对时间依赖 `Date.now()`，服务端渲染与客户端 hydration
                        之间可能跨过"1 分钟/1 小时"的边界而算出不同文字。
                        这是 React 官方的 hydration 豁免场景，标记一下即可
                        （不标记的话日志里就是一条 "server rendered HTML didn't match"）。
                      */}
                      <span className="ml-auto text-xs text-fg-subtle" suppressHydrationWarning>
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

function ArtifactDetail({
  artifact,
  onBack,
  threadId,
  published,
  onPublishedChange,
}: {
  artifact: Artifact;
  onBack: () => void;
  threadId?: string;
  published?: boolean;
  onPublishedChange?: (on: boolean) => void;
}) {
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
      <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
        <IconButton label="返回产物列表" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </IconButton>
        <span className="min-w-0 flex-1 truncate font-heading text-sm font-semibold text-fg">
          {artifact.title}
        </span>
        <span className="tnum shrink-0 text-xs text-fg-subtle">v{artifact.version}</span>
      </div>

      <VideoPlayer
        scenes={render.scenes}
        total={render.total}
        resetKey={artifact.messageId}
        variant="panel"
        finalUrl={render.finalUrl}
        title={artifact.title}
        /*
         * 右栏打开**跟播**：它的正下方就是分镜列表，而列表点击会 seek。
         * 标题跟着走，用户才看得出"刚才点的是哪一镜、现在在哪一镜"。
         * 显示成「整片名 · 分镜名」，不是只显示分镜名 —— 否则整片名会被顶掉，
         * 看起来像这段视频改了名字。
         */
        trackSceneTitle
        onPlayerReady={setPlayer}
        threadId={threadId}
        published={published}
        onPublishedChange={onPublishedChange}
      />

      <div className="flex items-center gap-2 px-3 py-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <span className="tnum ml-auto text-xs text-fg-subtle">
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
                    "t-tx flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-xs",
                    slot.state === "ready" ? "hover:bg-surface-2" : "cursor-not-allowed opacity-60",
                  )}
                >
                  <span className="tnum w-4 shrink-0 text-fg-subtle">{slot.index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-fg">{slot.title}</span>
                  {slot.state === "ready" ? (
                    <span className="tnum text-fg-muted">{formatDuration(slot.duration)}</span>
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

        <TabsContent value="info" className="pb-3 text-xs leading-relaxed text-fg-muted">
          <dl className="space-y-1.5">
            <div className="flex justify-between">
              <dt>分镜数</dt>
              <dd className="tnum text-fg">{render.total}</dd>
            </div>
            <div className="flex justify-between">
              <dt>总时长</dt>
              <dd className="tnum text-fg">{formatDuration(timeline.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>状态</dt>
              <dd className="text-fg">{playing ? "播放中" : status.label}</dd>
            </div>
          </dl>
          <p className="mt-3 flex gap-1.5 rounded-inner bg-surface-2 px-2 py-1.5">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-fg-subtle" />
            分镜按顺序渲染，渲好一段就点亮一段、自动续播。每段时长用的是渲染后的真实帧时长，
            不是大纲里的估算值 —— 所以进度条和分镜定位不会漂。
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
