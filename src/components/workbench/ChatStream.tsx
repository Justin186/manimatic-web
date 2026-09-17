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
      // 底部留白归零：任何一点灰（哪怕 4px）夹在白色卡片和白色输入框之间都会被看见。
      // 顶部留白保留（对话从上面开始时需要它）。
      className="scrollbar-thin flex-1 overflow-y-auto px-4 pt-5 md:px-8"
    >
      <div className="mx-auto flex max-w-[53rem] flex-col gap-5">
        {/* 空会话不会走到这里：那种情况由 Workbench 把输入框直接摆到中间 */}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              {/*
                气泡形状 = `rounded-card` + `rounded-br-[5px]`：
                右下角收成一个小直角，像"尾巴"一样指向说话人。
                ⚠️ 不要改成完整胶囊（`rounded-pill`）—— 胶囊会把尾巴吃掉，
                左右两边的气泡就只剩"对齐方向"这一个区分，一眼扫过去容易认错谁在说话。

                ⚠️ 也不要给气泡加描边：浅填充本身已经能从页面底和白卡片里分出来，
                再加一圈描边就成了"描边 + 填充"的双重标注，显重。
              */}
              <div className="max-w-[85%] rounded-card rounded-br-[5px] bg-solid px-4 py-2.5 text-sm leading-relaxed text-solid-fg">
                {/*
                  图片缩略图在文字**上面**：与"发出去的样子"一致（用户先选图再打字），
                  也和后端送进模型的顺序一致（图在前、文在后）。

                  ⚠️ 只贴图不打字时 m.text 是空串 —— 那种情况整个 <p> 不渲染，
                      否则气泡里会多出一行空白把图片顶下去。
                  ⚠️ 刷新后图片会消失（后端不存图，见 ImageAttachment 的说明）。
                      这不是 bug，是刻意的诚实降级；文字还在，所以气泡不会变空。
                */}
                {m.images && m.images.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {m.images.map((img) => (
                      // eslint-disable-next-line @next/next/no-img-element -- data URL 无法走 next/image 优化
                      <img
                        key={img.id}
                        src={img.dataUrl}
                        alt={img.name}
                        // 限高而不是限宽：题目照片多是竖的，限宽会让它撑得很高
                        className="max-h-48 rounded-control border border-solid-fg/15 object-contain"
                      />
                    ))}
                  </div>
                )}
                {/*
                  ⚠️ 这里**不要**加 whitespace-pre-wrap：用户气泡原先就没有它
                      （换行会被折叠）。顺手加上会改变现有排版行为，
                      那是与本次"加图片"无关的改动。
                */}
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <Avatar fallback={<Sparkles className="h-4 w-4" />} />
              <div className="min-w-0 flex-1 space-y-3">
                {m.version ? (
                  <span className="text-xs text-fg-subtle">第 {m.version} 版</span>
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
                      "whitespace-pre-wrap text-sm leading-7 text-fg",
                      m.streaming && "caret",
                    )}
                  >
                    {m.text}
                  </p>
                ) : m.streaming && !m.thinking ? (
                  // 没有思考内容时才显示那个孤立的光标：有思考指示器时它已经在动了，
                  // 再挂一个空光标只是重复噪音。
                  <p className="text-sm text-fg-subtle">
                    <span className="caret" />
                  </p>
                ) : null}

                {m.error && (
                  <p className="flex items-start gap-1.5 rounded-inner bg-err-soft px-3 py-2 text-xs text-err">
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
      </div>
      {/*
        滚动锚点必须放在间隔容器**外面**：放在里面时 `gap-5` 会在它前面多算 20px，
        于是最后一条内容和输入框之间就凭空多出一截空白（用户圈出来的那条缝）。
        它高度为 0，放里放外都能滚到，所以移出来没有任何副作用。
      */}
      <div ref={endRef} />
    </div>
  );
}
