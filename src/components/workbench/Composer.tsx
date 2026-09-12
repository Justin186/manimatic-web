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
};

export function Composer({
  busy,
  onSend,
  onAbort,
  simulateFailure,
  onSimulateFailureChange,
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

  return (
    <div className="flex flex-col items-center px-3.5 py-3">
      {/* 与对话流同宽并居中：左右栏收起/展开时输入框长度保持不变 */}
      {value === "" && (
        <div className="mb-2 flex w-full max-w-[53rem] flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => setValue(p)}
              className="rounded-full border border-line bg-canvas px-2.5 py-1 text-xs text-ink transition-colors hover:border-brick-600/40 hover:text-navy-900"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div
        className={cn(
          "flex w-full max-w-[53rem] items-end gap-2 rounded-lg border bg-surface px-3.5 py-2.5 transition-colors",
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
          placeholder="把题目发给我，例如：求 f(x)=x³-3x 的单调区间与极值"
          className="max-h-42 min-h-[3rem] flex-1 resize-none bg-transparent text-sm leading-6 text-navy-900 outline-none placeholder:text-ink-soft/70 disabled:opacity-60"
        />
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
      <div className="mt-1.5 flex w-full max-w-[53rem] items-center gap-3 text-xs text-ink-soft">
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
