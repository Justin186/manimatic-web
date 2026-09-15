"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  Film,
  ListChecks,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Input, Separator } from "@/components/ui/primitives";
import type { PlanState, PlanStep } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  plan: PlanStep[];
  state: PlanState;
  onChange: (plan: PlanStep[]) => void;
  onConfirm: () => void;
  onRegenerate: () => void;
  busy?: boolean;
};

export function StoryboardPlanCard({
  plan,
  state,
  onChange,
  onConfirm,
  onRegenerate,
  busy,
}: Props) {
  const [editing, setEditing] = useState(false);
  const total = plan.reduce((s, p) => s + p.durationSec, 0);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= plan.length) return;
    const next = [...plan];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(plan.filter((_, k) => k !== i));
  const setDuration = (i: number, d: number) =>
    onChange(plan.map((p, k) => (k === i ? { ...p, durationSec: Math.max(1, Math.round(d)) } : p)));

  const confirmed = state === "confirmed";

  return (
    <Card
      // 圆角降一档：对话流里"大纲 / 进度 / 播放器"是同一族的内联卡片（见另两处的同名注释），
      // 16px 在这一屏的小面片上显胖。
      className={cn("overflow-hidden rounded-inner", confirmed && "border-accent/40")}
      elevation={confirmed ? "flat" : "card"}
    >
      {/*
        ⚠️ 卡头**不上底色**，颜色只留在图标和序号上。

        这一处来回试了五种（`surface-2` 暖米色 / `accent-soft` / `accent-faint` / 不铺 …），
        结论是"卡头本来就不该上色"，而不是"要挑一个更淡的色" ——
        卡头是**结构**，序号才是**标记**。结构上色之后，
        同一块区域里就有两处暖色互相加码，怎么调都显重或显脏。
      */}
      <div className="flex items-center gap-2 px-3 py-2">
        <ListChecks className="h-4 w-4 text-accent" />
        <span className="font-heading text-sm font-semibold text-fg">分镜大纲</span>
        <span className="tnum text-xs text-fg-subtle">
          {plan.length} 个分镜 · 约 {total}s
        </span>
        <button
          onClick={() => setEditing((v) => !v)}
          className="t-tx ml-auto text-xs text-fg-muted underline-offset-2 hover:text-accent hover:underline"
        >
          {editing ? "完成编辑" : "编辑"}
        </button>
      </div>

      <Separator />

      <ol className="divide-y divide-border">
        {plan.map((step, i) => (
          <li key={step.id} className="flex items-start gap-3 px-3 py-2.5">
            {/*
              序号 = **很浅的品牌色填充 + 近黑数字**（取值见 `--t-solid`）。

              ⚠️ 对比度靠**字色**，不靠底色。底色是最浅一档的橙（几乎看不出色），
                 但数字是近黑，所以读起来毫不费力。
                 两边都试过：浅底 + 橙字（对比度太弱，序号扫不出来）、
                 深底 + 浅字（七个深色方块成了整屏最重的元素）—— 都不如这个组合。

              ⚠️ 圆角用 6px 而不是 `rounded-inner`(12px)：胶囊只有 24px 见方，
                 12px 正好是边长的一半，会渲染成一个**圆**；
                 圆形看着"软"，方形看着"准"，序号这类计数标记要的是后者。
                 （圆角令牌是按 32px 以上的控件标定的，小到 24px 的面片需要单独给值。）
            */}
            <span className="tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-solid text-xs font-semibold text-solid-fg">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              {/* 标题用 550 —— 介于 `font-medium`(500) 与 `font-semibold`(600) 之间。

                  ⚠️ 这个中间值能生效，前提是正文中文字体换成了**可变字重**的 Noto Sans SC。
                  系统中文栈（微软雅黑只有 Regular/Bold）会把 550 直接吸附成 Bold，
                  那就变成"太粗"了。换字体的原因与代价见 layout.tsx 和 §9.3。 */}
              <p className="truncate text-sm font-[550] text-fg">{step.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{step.summary}</p>
              {editing && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <label className="flex items-center gap-1 text-xs text-fg-muted">
                    <Clock className="h-3 w-3" />
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={step.durationSec}
                      onChange={(e) => setDuration(i, Number(e.target.value))}
                      className="tnum h-7 w-16 px-1.5 text-xs"
                    />
                    秒
                  </label>
                  <IconButton
                    label="上移"
                    size="sm"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="border border-border"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </IconButton>
                  <IconButton
                    label="下移"
                    size="sm"
                    onClick={() => move(i, 1)}
                    disabled={i === plan.length - 1}
                    className="border border-border"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </IconButton>
                  <IconButton
                    label="删除这个分镜"
                    size="sm"
                    onClick={() => remove(i)}
                    className="border border-border text-err hover:bg-err-soft hover:text-err"
                  >
                    <Trash2 className="h-3 w-3" />
                  </IconButton>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {!confirmed && (
        <>
          <Separator />
          <div className="flex flex-wrap items-center gap-2 bg-surface px-3 py-2.5">
            <Button size="sm" variant="grad" onClick={onConfirm} disabled={busy || plan.length === 0}>
              <Check className="h-4 w-4" />
              确认生成
            </Button>
            <Button size="sm" variant="ghost" onClick={onRegenerate} disabled={busy}>
              <RefreshCw className="h-4 w-4" />
              重新生成大纲
            </Button>
            <span className="ml-auto flex items-center gap-1 text-xs text-fg-subtle">
              <Film className="h-3 w-3" />
              确认后开始逐分镜渲染
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
