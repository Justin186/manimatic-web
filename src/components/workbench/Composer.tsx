"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QUICK_PROMPTS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Props = {
  busy: boolean;
  onSend: (text: string) => void;
  onAbort?: () => void;
  /** 演示用开关：真实产品不会有，答辩时用来展示"单分镜失败 + 重试"这条路径 */
  simulateFailure?: boolean;
  onSimulateFailureChange?: (v: boolean) => void;
  /**
   * 紧凑模式：隐藏底部那行（快捷键提示 + 演示开关），只留输入框本身。
   * 用于空会话时把输入框摆到正中间 —— 那一屏只有输入框，
   * "⌘\ 收起历史栏"这类提示和"模拟渲染失败"混在旁边会显得很杂。
   */
  compact?: boolean;
};

export function Composer({
  busy,
  onSend,
  onAbort,
  simulateFailure,
  onSimulateFailureChange,
  compact,
}: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    onSend(text);
    setValue("");
  };

  // 外层只做两件事：**居中**（items-center）与**留白**。
  // 它横跨整个中栏，所以不该画任何东西 —— 一旦沾上底色，看着就像"凭空多出一层容器"。
  //
  // ⚠️ **顶部 padding 必须是 0**。它曾经是 8px，而页面底色 #F4F5F7 与输入框的白色
  // 明度太接近，那 8px 夹在白色视频卡片和白色输入框之间时不像留白、倒像一块贴错位置
  // 的面板（用户为此圈了好几次）。底部留白保留，输入框不该贴在窗口最下沿。
  //
  // ⚠️ 这段说明必须是 `//` 而不是 `{/* */}`：后者是 JSX 注释，只能写在元素**内部**，
  // 放在 `return (` 的根位置会被解析成对象字面量，直接编译失败。
  return (
    <div className="flex flex-col items-center px-3.5 pb-3">
      {/* 与对话流同宽并居中：左右栏收起/展开时输入框长度保持不变 */}
      <div
        className={cn(
          "flex w-full max-w-[53rem] flex-col border bg-surface transition-all",
          // 圆角与投影：两档都带投影（对话中那一档更弱，别跟正文抢注意力），
          // 聚焦时加深 —— 对应豆包那种"常态柔和浮起、聚焦描边变深"的观感。
          //
          // 投影**向四周自然扩散**（不加负 spread 去限制方向）。曾经担心"向上会脏到
          // 最后一条内容"，其实不会：输入框在 DOM 里排在对话流之后，它的影子画在
          // 内容之上 —— 那正是浮起来该有的样子，不是污渍。
          compact
            ? "rounded-2xl px-4 pb-3 pt-3.5 shadow-[0_4px_20px_rgba(18,38,63,0.10)] focus-within:shadow-[0_6px_26px_rgba(18,38,63,0.15)]"
            : "rounded-xl px-3.5 pb-2.5 pt-3 shadow-[0_3px_14px_rgba(18,38,63,0.08)] focus-within:shadow-[0_5px_20px_rgba(18,38,63,0.13)]",
          busy ? "border-brick-600/40" : "border-line focus-within:border-brick-600",
        )}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={
            compact ? "输入一个知识点或一道题" : "继续提问，或说说要改哪里"
          }
          className="max-h-60 min-h-[2.5rem] w-full resize-none bg-transparent text-base leading-7 text-navy-900 outline-none placeholder:text-ink-soft/70 disabled:opacity-60"
        />

        {/*
          输入框**内部**的工具条（主流形态：DeepSeek 的「深度思考 / 智能搜索」、
          豆包底部的功能行都在这个位置）。现在只有发送 / 停止，靠右。

          这里曾经放过「精简 / 详细 / 活泼」的切换，已移除 —— 同一个设置出现在两处
          （设置页 + 输入框），改起来方便但看的时候容易怀疑"以哪个为准"，不如只留一处。
        */}
        <div className="mt-2 flex items-center justify-end">
          {busy ? (
            <Button size="icon" variant="subtle" onClick={onAbort} aria-label="停止生成">
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={submit}
              disabled={!value.trim()}
              aria-label="发送"
              className="bg-navy-900"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/*
        推荐问题**只在空会话时出现** —— 它是"第一次该问什么"的提示。

        ⚠️ 对话已经开始之后不要留着它：那时用户是来追问或改东西的，
           输入框底下还挂着一排「讲一下导数是什么」，只会让人怀疑自己点错了地方。

        ⚠️ 空态下开始打字时**淡出但保留占位**，不要直接不渲染：
           那一屏是垂直居中的，这块一消失整组内容就会往下跳一截 ——
           字打到一半输入框自己动了位置，非常难受。所以用 opacity 而不是条件渲染。
      */}
      {compact ? (
        <div
          className={cn(
            "mt-3 flex w-full max-w-[53rem] flex-wrap gap-1.5 transition-opacity duration-150",
            value !== "" && "pointer-events-none opacity-0",
          )}
          aria-hidden={value !== ""}
        >
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => setValue(p)}
              className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs text-ink shadow-[0_1px_2px_rgba(18,38,63,0.04)] transition-colors hover:border-brick-600/50 hover:bg-brick-100/50 hover:text-navy-900"
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          "mt-1.5 flex w-full max-w-[53rem] items-center gap-3 text-xs text-ink-soft",
          // 居中摆输入框时（空会话）只留输入框本身，把提示与演示开关收起来
          compact && "hidden",
        )}
      >
        <p className="min-w-0 flex-1 truncate">
          Enter 发送 · Shift + Enter 换行 · ⌘/Ctrl + \ 收起历史栏
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={simulateFailure}
          onClick={() => onSimulateFailureChange?.(!simulateFailure)}
          title="演示用：让第 3 个分镜渲染失败，用于展示单分镜重试"
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded border px-2 py-0.5 transition-colors",
            simulateFailure
              ? "border-warn-600/40 bg-warn-600/10 text-warn-600"
              : "border-line bg-surface text-ink-soft hover:text-navy-900",
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          模拟渲染失败
        </button>
      </div>
    </div>
  );
}
