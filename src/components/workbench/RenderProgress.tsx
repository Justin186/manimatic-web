"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/primitives";
import type { RenderState, SceneStatus } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";

const STATUS_META: Record<SceneStatus, { label: string; tone: "neutral" | "info" | "ok" | "err" }> = {
  queued: { label: "排队中", tone: "neutral" },
  rendering: { label: "渲染中", tone: "info" },
  done: { label: "已完成", tone: "ok" },
  error: { label: "失败", tone: "err" },
};

const STAGE_LABEL: Record<string, string> = {
  prewarm: "预编译公式",
  rendering: "渲染分镜",
  concat: "合成成片",
};

/** 顶部那行状态文案。三态 × 四阶段的组合，内联三元会难读到看不出分支。 */
function headLine(
  status: RenderState["status"],
  stage: RenderState["stage"],
  step: number,
  total: number,
  failedCount: number,
) {
  if (status === "done") return `已出片 · ${total} 个分镜`;
  if (status === "error") return `${failedCount} 个分镜未成功`;
  if (status !== "running") return `${total} 个分镜`;
  // 预编译发生在渲染之前、一次做完，不分摊到各分镜上 —— 报 "0/8" 会让人
  // 以为卡住了。它只占整条链路很短一段，直接显示阶段名即可。
  if (stage === "prewarm") return STAGE_LABEL.prewarm;
  return `${STAGE_LABEL[stage ?? "rendering"]} ${step}/${total}`;
}

type Props = {
  render: RenderState;
  onRetry: (index: number) => void;
  onRevise?: (index: number) => void;
  retrying?: number | null;
};

export function RenderProgress({ render, onRetry, onRevise, retrying }: Props) {
  const { scenes, step, total, stage, status } = render;
  const pct = total ? Math.round((step / total) * 100) : 0;
  const failed = scenes.filter((s) => s.status === "error");

  /**
   * 出片后自动收起成一行摘要。
   *
   * 为什么不直接删掉：分镜状态（尤其"AI 改"入口）出片后依然有用，
   * 只是不该再占着对话流一大块 —— 所以收起成一个可点开的摘要行。
   *
   * 为什么失败时不收：失败是需要用户处理的状态，藏起来等于把问题藏起来。
   */
  const collapsible = status === "done" && failed.length === 0;
  /**
   * 用户是否手动展开过。
   *
   * 只在"渲染完成后"才有意义 —— 渲染中/失败时本来就完整显示。
   * 不额外写 effect 去复位它：一旦完成就保持用户的选择，
   * 而且在 effect 里同步 setState 会触发级联渲染（react-hooks 规则会报错）。
   */
  const [expandedByUser, setExpandedByUser] = useState(false);

  const collapsed = collapsible && !expandedByUser;
  const totalDuration = scenes.reduce((s, sc) => s + (sc.durationSec ?? 0), 0);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setExpandedByUser(true)}
        aria-expanded={false}
        className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-navy-900/20 hover:bg-canvas/60"
      >
        <Check className="h-3.5 w-3.5 shrink-0 text-ok-600" />
        <span className="text-sm text-navy-900">
          已出片 · {total} 个分镜
          {totalDuration > 0 && (
            <span className="tnum text-ink-soft"> · {formatDuration(totalDuration)}</span>
          )}
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs text-ink-soft">
          详情
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        {status === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-brick-600" />
        ) : status === "done" ? (
          <Check className="h-3.5 w-3.5 text-ok-600" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-err-600" />
        )}
        <span className="text-sm font-medium text-navy-900">
          {headLine(status, stage, step, total, failed.length)}
        </span>
        <span className="tnum ml-auto text-xs text-ink-soft">{pct}%</span>

        {collapsible && (
          <button
            type="button"
            onClick={() => setExpandedByUser(false)}
            aria-expanded
            className="rounded p-0.5 text-ink-soft transition-colors hover:bg-canvas hover:text-navy-900"
            aria-label="收起"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-180" />
          </button>
        )}
      </div>

      <Progress value={pct} />

      <ul className="mt-3 space-y-1.5">
        {scenes.map((sc) => (
          <li key={sc.index} className="flex items-start gap-2 text-xs">
            <span className="tnum mt-0.5 w-4 shrink-0 text-ink-soft">{sc.index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-navy-900">{sc.title}</span>

            {onRevise && sc.status === "done" && (
              <button
                onClick={() => onRevise(sc.index)}
                className="shrink-0 text-xs text-ink-soft underline-offset-2 hover:text-navy-900 hover:underline"
              >
                AI 改
              </button>
            )}

            {sc.status === "error" ? (
              <span className="flex items-center gap-1.5">
                <span className="max-w-56 truncate text-err-600" title={sc.message}>
                  {sc.message}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => onRetry(sc.index)}
                  disabled={retrying === sc.index}
                >
                  <RefreshCw
                    className={cn("h-3 w-3", retrying === sc.index && "animate-spin")}
                  />
                  重试
                </Button>
              </span>
            ) : (
              <Badge tone={STATUS_META[sc.status].tone}>{STATUS_META[sc.status].label}</Badge>
            )}
          </li>
        ))}
      </ul>

      {status === "error" && (
        <p className="mt-2 rounded bg-err-600/5 px-2 py-1.5 text-xs text-err-600">
          只重渲失败的那一段就行 —— 已完成的分镜可以直接播放，不用整条重来。
        </p>
      )}
    </div>
  );
}
