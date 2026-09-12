"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, ChevronRight } from "lucide-react";

import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = { message: Message };

/**
 * 「正在思考…」指示器。
 *
 * 存在的唯一理由：开了深度思考的模型，**正文要等思考走完才出字**
 * （实测中转站要 49 秒，`/api/chat` 端到端 93 秒）。这段时间里如果界面上
 * 什么都不动，用户只会以为程序卡死了 —— 而这几十秒里唯一在动的东西就是思考流。
 *
 * 三个刻意的设计：
 *
 * 1. **默认折叠，只显示"已思考 N 秒"**。推理内容不是给用户看的回答，
 *    直接铺一屏会把真正的回答淹掉；展开是用户的主动选择。
 * 2. **展开后是完整内容 + 滚轮查看（不截断）**。曾经只渲染最后 320 字，
 *    结果是"共 2080 字、却只能看 320 字"——数字和内容对不上本身就是坏体验。
 *    现在全量渲染、固定高度内部滚动：想回看多久以前的过程都能往上翻。
 * 3. **正文一到就自动收起**。正文出现时 Workbench 会把 `thinkingLive` 置 false，
 *    于是这里回到折叠态 —— 那时用户要读的是回答，"我还在想什么"已经没价值了。
 *
 * 关于全量渲染：实测单轮思考可达 2.5 万字，一块静态文本直接排版没问题。
 * 真正要防的是"每收到一个片段就重排整段"，而思考在正文开始后就停止追加，
 * 不存在持续重排。
 */
export function ThinkingIndicator({ message }: Props) {
  // null = 还没手动点过，跟随"是否还在思考"自动开合
  const [manual, setManual] = useState<boolean | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const endRef = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);

  const thinking = message.thinking ?? "";
  const live = Boolean(message.thinkingLive);
  const startedAt = message.thinkingStartedAt ?? message.createdAt;

  // 还在思考时每秒走一下，秒数才是活的；结束后定时器停掉，不留无意义的重渲染。
  // （刻意不在 effect 里同步 setNow：那是级联渲染，React 明确不建议。）
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [live]);

  const open = manual ?? live;

  // 展开时贴底滚动；**用户一旦往上滚就不再拽回底部** —— 否则正想看前面的过程，
  // 新内容一到就被强行拉到底（和 ChatStream 的"贴底"是同一套规矩）。
  useEffect(() => {
    if (!open) return;
    const el = endRef.current?.parentElement;
    if (stick.current) el?.scrollTo({ top: el.scrollHeight });
  }, [thinking.length, open]);

  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));

  return (
    <div className="anim-rise overflow-hidden rounded-md border border-line bg-canvas">
      <button
        type="button"
        onClick={() => setManual(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs text-ink-soft transition-colors hover:text-navy-900"
      >
        <Brain className={cn("h-3.5 w-3.5 shrink-0", live && "text-brick-600")} />
        {live ? (
          <>
            <span className="text-brick-700">正在思考…</span>
            <span className="tnum">已 {seconds}s</span>
          </>
        ) : (
          <span>思考过程</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {/* 字数一直显示：它也是"这一轮模型想了多少"的一个可读信号 */}
          <span className="tnum text-ink-soft/70">
            {seconds}s · 共 {thinking.length} 字
          </span>
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")}
          />
        </span>
      </button>

      {open && thinking ? (
        <div
          // 固定高度（约 22rem）+ 内部滚动：这是"完整内容用滚轮看"的关键 ——
          // 不设高度的话一万多字会把整条对话流撑得极长，反而更难读。
          className="scrollbar-thin max-h-[22rem] overflow-y-auto border-t border-line/70 px-2.5 py-2"
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
        >
          {/* 全文，不截断 */}
          <p className="whitespace-pre-wrap text-xs leading-5 text-ink-soft/90">
            {thinking}
          </p>
          <div ref={endRef} />
        </div>
      ) : null}
    </div>
  );
}
