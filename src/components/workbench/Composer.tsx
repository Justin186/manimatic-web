"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QUICK_PROMPTS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

import { ModelPicker } from "./ModelPicker";

type Props = {
  busy: boolean;
  onSend: (text: string) => void;
  onAbort?: () => void;
  /**
   * 紧凑模式：隐藏底部那行快捷键提示，只留输入框本身。
   * 用于空会话时把输入框摆到正中间 —— 那一屏只有输入框，
   * "⌘\ 收起历史栏"这类提示混在旁边会显得很杂。
   */
  compact?: boolean;
};

export function Composer({ busy, onSend, onAbort, compact }: Props) {
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

  /*
   * ⚠️ 发送按钮**两档共用同一个 `size="icon"`（40px），不要再单独压小它**：
   * 曾经为了压高度把它收到 32（`h-8 w-8`），用户一眼就看出来"对话页的比新对话的小一号"。
   * **同一个组件在两处尺寸不同，比"高 8px"刺眼得多。**
   *
   * ⚠️⚠️ **"把模型胶囊往下挪"要改的是下内边距 `pb`，不是 `mt`。** 这条踩了三轮才搞清：
   *
   *   - 对话页的输入框**贴着窗口底部**（上面是 `flex-1` 的对话流），卡片变高只会往上长 ——
   *     加大 `mt` 时胶囊在屏幕上的位置**一个像素都不动**（只是卡片顶边往上跑了）。
   *   - 草稿页的输入框**垂直居中**，卡片变高上下各摊一半 —— `mt` 加 10px，胶囊只下移 5px。
   *   - 胶囊离卡片底边的距离 = `pb + 4`（那 4px 是它在 40px 工具条里上下各留的余量）。
   *     所以"再往下 N px"就是 `pb` 减 N，两个页面都成立（居中页是 N/2）。
   *
   * 现状：`pb` 8px（决定胶囊/按钮离底边多远，已经贴到圆角附近，是下限）
   * + `mt` 12px（上方那段呼吸，只是"别贴着正文"，不参与定位）。
   *
   *   空态   14 + 40 + 12 + 40 + 8 = 114px
   *   对话中 10 + 36 + 12 + 40 + 8 = 106px
   */

  // 外层只做两件事：**居中**（items-center）与**留白**。
  // 它横跨整个中栏，所以不该画任何东西 —— 一旦沾上底色，看着就像"凭空多出一层容器"。
  //
  // ⚠️ **顶部 padding 必须是 0**。它曾经是 8px，而页面底色与输入框的白色
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
          "t-tx flex w-full max-w-[53rem] flex-col border bg-surface",
          // 圆角与投影：两档都带投影（对话中那一档更弱，别跟正文抢注意力），
          // 聚焦时描边变品牌色、投影加深 —— "常态柔和浮起、聚焦时收紧"的观感。
          // 下内边距两档一致（`pb-2` = 8px）：它同时决定**发送按钮离底边多远**
          // 和**胶囊离底边多远**（后者再 +4px），所以两档写一样才不会被看成两个东西
          compact
            ? "rounded-card px-4 pt-3.5 pb-2 shadow-raised focus-within:shadow-pop"
            : "rounded-inner px-4 pt-2.5 pb-2 shadow-card focus-within:shadow-raised",
          busy ? "border-accent/40" : "border-border focus-within:border-accent",
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
          placeholder={compact ? "输入一个知识点或一道题" : "继续提问，或说说要改哪里"}
          className={cn(
            "max-h-60 w-full resize-none bg-transparent text-base leading-7 text-fg outline-none",
            "placeholder:text-fg-subtle disabled:opacity-60",
            compact ? "min-h-[2.5rem]" : "min-h-[2.25rem]",
          )}
        />

        {/*
          输入框**内部**的工具条（主流形态：DeepSeek 的「深度思考 / 智能搜索」、
          豆包底部的功能行都在这个位置）：**左边选模型、右边发送 / 停止**。

          这里曾经放过「精简 / 详细 / 活泼」的切换，已移除 —— 同一个设置出现在两处
          （设置页 + 输入框），改起来方便但看的时候容易怀疑"以哪个为准"，不如只留一处。
          模型切换则是反过来：它是**提问前的选择**，用户在打字的这一刻就想得到它，
          逼他先去设置页转一圈才回来问，是把这个决定放错了地方。
          （两处的后端接口本来就是同一个，不存在"以哪个为准"的问题。）
        */}
        {/*
          工具条间距 `mt` = 上方那段"空气"。**它不负责把胶囊往下挪**（见上面那段 ⚠️⚠️），
          只决定"正文到工具条"的呼吸感，所以别拿它当高度的配重：一路加到 30px 之后，
          用户在 DevTools 里直接圈出这片 margin（橙色那一条）说"太宽了"。
          8px 会贴着正文，30px 是一道空槽，**12px 才是"分成两块"又不空**的量。
        */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <ModelPicker disabled={busy} />
          {busy ? (
            <Button size="icon" variant="soft" onClick={onAbort} aria-label="停止生成">
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="grad"
              onClick={submit}
              disabled={!value.trim()}
              aria-label="发送"
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
              className={cn(
                "t-tx rounded-pill border border-border bg-surface px-3.5 py-1.5 text-xs text-fg shadow-card",
                "hover:border-accent hover:bg-accent-soft hover:text-accent",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}

      {/*
        快捷键提示。原来这里右侧还挂过一个「模拟渲染失败」开关（演示单分镜重试用），
        已经删掉：它是给答辩现场准备的道具，摆在产品界面上只会让人以为系统不稳定。
        mock 与后端接口层面的 `simulateFailure` **保留着** —— 那是唯一能演示
        "单分镜失败 → 重试"这条交互的入口，只是不再从界面上点。
      */}
      <div
        className={cn(
          "mt-1.5 w-full max-w-[53rem] text-xs text-fg-subtle",
          // 居中摆输入框时（空会话）只留输入框本身
          compact && "hidden",
        )}
      >
        <p className="truncate">Enter 发送 · Shift + Enter 换行 · ⌘/Ctrl + \ 收起历史栏</p>
      </div>
    </div>
  );
}
