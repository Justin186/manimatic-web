"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";

import { Avatar } from "@/components/ui/fragments";
import { RenderProgress } from "./RenderProgress";
import { StoryboardPlanCard } from "./StoryboardPlanCard";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { VideoSegmentCard } from "./VideoSegmentCard";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  messages: Message[];
  onPlanChange: (messageId: string, plan: Message["plan"]) => void;
  onConfirm: (messageId: string) => void;
  onRegenerate: (messageId: string) => void;
  onRetry: (messageId: string, index: number) => void;
  onRevise?: (messageId: string, index: number) => void;
  /** 打开右栏里这条消息对应的产物详情（内联卡片的「详情」按钮） */
  onOpenArtifact: (messageId: string) => void;
  busy?: boolean;
  retryingIndex?: number | null;
};

export function ChatStream({
  messages,
  onPlanChange,
  onConfirm,
  onRegenerate,
  onRetry,
  onRevise,
  onOpenArtifact,
  busy,
  retryingIndex,
}: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);

  // 流式输出时自动滚底；但用户一旦上滑查看历史，就停止跟随（否则会被强行拽回底部）
  useEffect(() => {
    if (stick.current) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  return (
    <div
      onScroll={onScroll}
      className="scrollbar-thin flex-1 overflow-y-auto px-4 py-5 md:px-8"
    >
      <div className="mx-auto flex max-w-[53rem] flex-col gap-5">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-navy-900 px-4 py-2.5 text-sm leading-relaxed text-white">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <Avatar fallback={<Sparkles className="h-4 w-4" />} className="bg-brick-600" />
              <div className="min-w-0 flex-1 space-y-3">
                {m.version ? (
                  <span className="text-xs text-ink-soft">第 {m.version} 版</span>
                ) : null}

                {/*
                  思考指示器放在正文**上面**：开启深度思考时它会先出现并一直动，
                  正文随后才到。正文为空时它就是唯一的反馈来源，
                  所以两个分支都得渲染它 —— 它自己会按 thinkingLive 决定收起。
                */}
                {m.thinking ? <ThinkingIndicator message={m} /> : null}

                {m.text ? (
                  <p
                    className={cn(
                      "whitespace-pre-wrap text-sm leading-7 text-navy-900",
                      m.streaming && "caret",
                    )}
                  >
                    {m.text}
                  </p>
                ) : m.streaming && !m.thinking ? (
                  // 没有思考内容时才显示那个孤立的光标：有思考指示器时它已经在动了，
                  // 再挂一个空光标只是重复噪音。
                  <p className="text-sm text-ink-soft">
                    <span className="caret" />
                  </p>
                ) : null}

                {m.error && (
                  <p className="flex items-start gap-1.5 rounded-md bg-err-600/5 px-3 py-2 text-xs text-err-600">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {m.error}
                  </p>
                )}

                {m.plan && m.plan.length > 0 && (
                  <StoryboardPlanCard
                    plan={m.plan}
                    state={m.planState ?? "pending"}
                    onChange={(p) => onPlanChange(m.id, p)}
                    onConfirm={() => onConfirm(m.id)}
                    onRegenerate={() => onRegenerate(m.id)}
                    busy={busy}
                  />
                )}

                {m.render && (
                  <RenderProgress
                    render={m.render}
                    onRetry={(i) => onRetry(m.id, i)}
                    onRevise={onRevise ? (i) => onRevise(m.id, i) : undefined}
                    retrying={retryingIndex}
                  />
                )}

                {m.render && (
                  <VideoSegmentCard
                    scenes={m.render.scenes}
                    total={m.render.total}
                    resetKey={m.id}
                    finalUrl={m.render.finalUrl}
                    // 与右栏产物卡片用同一套标题推导，避免同一段视频两处叫不同名字
                    title={m.plan?.[0]?.title ?? m.text.slice(0, 24)}
                    // 点右上角「详情」→ 打开这条消息对应的产物详情
                    onOpenDetail={() => onOpenArtifact(m.id)}
                  />
                )}
              </div>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
