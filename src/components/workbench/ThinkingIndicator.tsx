"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, ChevronRight } from "lucide-react";

import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = { message: Message };

/**
 * 「这个思考块上次被看到时是展开还是收起」—— 按消息 id 记，**放在组件外面**。
 *
 * 为什么必须在外面：切换会话会把整条对话流卸载（`/app/t/A` → 回 `/app/t/B`
 * 也一样），组件里的 `useState` 跟着一起没。于是"我离开时它是展开的"这件事
 * 只剩外面的记忆能回答 —— 若重新挂载时只拿 `thinkingLive` 重新推导，
 * 就会出现这个真实反馈的形态：
 *
 *     思考在我**没看着的时候**结束 → `thinkingLive` 已经是 false
 *     → 块被无声收起 → 切回来只看到一行"思考过程 Ns · 共 N 字"，
 *       离开前正在读的那段推理不见了（用户的原话是"深度思考那里不见了"）。
 *
 * 与 `lib/streams.ts` 把 AbortController 放到模块级是同一个理由：
 * **会随组件卸载丢掉、但语义上属于"这次会话"的状态，就必须待在组件外面。**
 *
 * 只存一个布尔、按消息 id 一条，生命周期跟着页面走（量级是"这条会话里出过思考的
 * 消息数"，不清理也涨不了多少，为一个 UI 开关单独加清理逻辑反而多一处可能出错的地方）。
 */
const seenOpen = new Map<string, boolean>();

/**
 * 「正在思考…」指示器。
 *
 * 存在的唯一理由：开了深度思考的模型，**正文要等思考走完才出字**
 * （实测中转站要 49 秒，`/api/chat` 端到端 93 秒）。这段时间里如果界面上
 * 什么都不动，用户只会以为程序卡死了 —— 而这几十秒里唯一在动的东西就是思考流。
 *
 * 四个刻意的设计：
 *
 * 1. **默认折叠，只显示"已思考 N 秒"**。推理内容不是给用户看的回答，
 *    直接铺一屏会把真正的回答淹掉；展开是用户的主动选择。
 * 2. **展开后是完整内容 + 滚轮查看（不截断）**。曾经只渲染最后 320 字，
 *    结果是"共 2080 字、却只能看 320 字"——数字和内容对不上本身就是坏体验。
 *    现在全量渲染、固定高度内部滚动：想回看多久以前的过程都能往上翻。
 * 3. **正文一到就自动收起**。正文出现时 Workbench 会把 `thinkingLive` 置 false，
 *    于是这里回到折叠态 —— 那时用户要读的是回答，"我还在想什么"已经没价值了。
 *    ⚠️ 这条**只在用户看着它的时候**才成立：切走期间结束的，下次进来按
 *       他离开时的样子还原（见下面的 `seenOpen`），不能替他做主收起来。
 * 4. **开合状态跟着会话走，不跟着组件实例走**。同一段思考切走再回来应长得一样：
 *    离开时是展开的，回来还是展开的（哪怕这期间思考已经结束）。
 *
 * 关于全量渲染：实测单轮思考可达 2.5 万字，一块静态文本直接排版没问题。
 * 真正要防的是"每收到一个片段就重排整段"，而思考在正文开始后就停止追加，
 * 不存在持续重排。
 */
export function ThinkingIndicator({ message }: Props) {
  // null = 还没定过，跟随"是否还在思考"自动开合。
  // 只有一种情况需要接管：**思考已经结束**（`thinkingLive` 为 false）——
  // 这是"它在我没看着的时候走完了"，要还原成我离开时的样子（展开过就还展开）。
  // 还在思考的一律不接管，交回自动规则：这样"正文到达自动收起"、以及重新生成后
  // 新的一轮思考该展开，都照旧成立，不会被上一轮留下的收起状态带歪。
  const [manual, setManual] = useState<boolean | null>(() => {
    if (message.thinkingLive) return null;
    return seenOpen.get(message.id) ? true : null;
  });
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

  // 记下"此刻看起来是什么样"：切走再回来要还原成一样的（见上面 seenOpen 的说明）。
  // 记的是**最终开合**而不是"用户有没有手动点过"：两者的可观察结果一样，
  // 多存一个标记只会多一处可能不同步的状态。
  useEffect(() => {
    seenOpen.set(message.id, open);
  }, [message.id, open]);

  // 展开时贴底滚动；**用户一旦往上滚就不再拽回底部** —— 否则正想看前面的过程，
  // 新内容一到就被强行拉到底（和 ChatStream 的"贴底"是同一套规矩）。
  useEffect(() => {
    if (!open) return;
    const el = endRef.current?.parentElement;
    if (stick.current) el?.scrollTo({ top: el.scrollHeight });
  }, [thinking.length, open]);

  // 秒数：还活着时按秒走实时计时（`now` 每秒更新一次）；
  // 结束后优先用**后端落盘的那个值** —— 恢复出来的消息没有 thinkingStartedAt，
  // 拿 createdAt 去减会把一条几天前的消息显示成"259200s"。
  const seconds =
    !live && message.thinkingSec != null
      ? message.thinkingSec
      : Math.max(0, Math.round((now - startedAt) / 1000));

  return (
    <div className="anim-rise overflow-hidden rounded-inner border border-border bg-surface-2">
      <button
        type="button"
        onClick={() => setManual(!open)}
        aria-expanded={open}
        className="t-tx flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs text-fg-muted hover:text-fg"
      >
        <Brain className={cn("h-3.5 w-3.5 shrink-0", live && "text-accent")} />
        {live ? (
          <>
            <span className="text-accent">正在思考…</span>
            <span className="tnum">已 {seconds}s</span>
          </>
        ) : (
          <span>思考过程</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {/* 字数一直显示：它也是"这一轮模型想了多少"的一个可读信号 */}
          <span className="tnum text-fg-subtle">
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
          className="scrollbar-thin max-h-[22rem] overflow-y-auto border-t border-border px-2.5 py-2"
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
        >
          {/* 全文，不截断 */}
          <p className="whitespace-pre-wrap text-xs leading-5 text-fg-muted">{thinking}</p>
          <div ref={endRef} />
        </div>
      ) : null}
    </div>
  );
}
