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
import { Separator } from "@/components/ui/primitives";
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
    <Card className={cn("overflow-hidden", confirmed && "border-navy-900/20")}>
      <div className="flex items-center gap-2 bg-canvas/60 px-3 py-2">
        <ListChecks className="h-4 w-4 text-brick-600" />
        <span className="font-serif-cn text-sm font-semibold text-navy-900">分镜大纲</span>
        <span className="tnum text-xs text-ink-soft">
          {plan.length} 个分镜 · 约 {total}s
        </span>
        <button
          onClick={() => setEditing((v) => !v)}
          className="ml-auto text-xs text-ink-soft underline-offset-2 hover:text-navy-900 hover:underline"
        >
          {editing ? "完成编辑" : "编辑"}
        </button>
      </div>

      <Separator />

      <ol className="divide-y divide-line">
        {plan.map((step, i) => (
          <li key={step.id} className="flex items-start gap-3 px-3 py-2.5">
            <span className="tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded bg-navy-900 text-xs font-semibold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-navy-900">{step.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{step.summary}</p>
              {editing && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-ink-soft">
                    <Clock className="h-3 w-3" />
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={step.durationSec}
                      onChange={(e) => setDuration(i, Number(e.target.value))}
                      className="tnum w-16 rounded border border-line px-1.5 py-0.5 text-xs text-navy-900"
                    />
                    秒
                  </label>
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="rounded border border-line p-1 text-ink-soft hover:text-navy-900 disabled:opacity-40"
                    aria-label="上移"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === plan.length - 1}
                    className="rounded border border-line p-1 text-ink-soft hover:text-navy-900 disabled:opacity-40"
                    aria-label="下移"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => remove(i)}
                    className="rounded border border-line p-1 text-ink-soft hover:text-err-600"
                    aria-label="删除"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {!confirmed && (
        <>
          <Separator />
          <div className="flex items-center gap-2 bg-surface px-3 py-2.5">
            <Button size="sm" onClick={onConfirm} disabled={busy || plan.length === 0}>
              <Check className="h-4 w-4" />
              确认生成
            </Button>
            <Button size="sm" variant="ghost" onClick={onRegenerate} disabled={busy}>
              <RefreshCw className="h-4 w-4" />
              重新生成大纲
            </Button>
            <span className="ml-auto flex items-center gap-1 text-xs text-ink-soft">
              <Film className="h-3 w-3" />
              确认后开始逐分镜渲染
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
