import { realDuration } from "@/lib/mock-data";

import { recallCanned, setFailures, sleep, sse } from "../../_stream";

export const dynamic = "force-dynamic";

/**
 * POST /api/render/confirm —— Mock 实现。
 *
 * ⚠️ 2026-09-12 契约变更（见 docs/分镜实时交付-契约与前端改造.md §2）：
 * 后端已从"多进程并行渲染"改为「一个 Scene 演到底 + 边渲边切」，
 * 于是这里**不再打乱完成顺序** —— `@@ {"section": N}` 严格 1,2,3…N 递增。
 *
 * 之所以 Mock 必须跟着改：乱序是"并行渲染"的产物，而后端已经把并行这条路
 * 实测否决掉了（瓶颈是内存带宽，8 进程反而更慢）。Mock 继续乱序发，
 * 就会让前端长期保留一个在真实链路上永远不触发的缓冲编排器。
 *
 * 另外两处刻意保留的"真实特性"：
 *
 * 1. **时长用真实帧时长**（`segmentDurations`，等价于后端 `sections/index.json`
 *    的 `duration`），不是大纲的 `plan[].durationSec`（设计值）。两者故意有出入，
 *    前端若用设计值铺时间轴，分镜定位就会漂。
 * 2. **单分镜失败**：simulateFailure 打开时让第 3 个分镜失败，
 *    用来演示 Q12-B 的"单分镜重试"（绝不让整条任务失败）。
 *    > 注意：真后端在串行模型下是整条重跑（13s 可控），但前端的重试交互
 *    > 仍然保留 —— 它是"失败可定位到分镜"的入口，见契约文档 §4.1。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    thread_id?: string;
    plan?: { durationSec?: number }[];
    simulateFailure?: boolean;
  };
  const threadId = body.thread_id ?? "demo";
  const canned = recallCanned(threadId);
  const plan = body.plan ?? [];
  const total = Math.max(1, plan.length || canned.segments.length);

  const failIndex = body.simulateFailure ? Math.min(2, total - 1) : -1;
  setFailures(threadId, failIndex >= 0 ? [failIndex] : []);

  return sse(async (send) => {
    send("tool_call", { name: "render_storyboard", args: { segmentCount: total } });

    // LaTeX 批处理预热：后端在渲染前把所有公式一次性编译（实测 28 个公式 39s → 1.4s）。
    // 它发生在渲染之前、一次做完，所以这里只报一次，不要逐分镜循环 ——
    // 那会让人以为每个分镜都在重复预热。
    send("tool_progress", { step: 0, total, stage: "prewarm" });
    await sleep(600);

    // 单进程串行渲染：分镜 1 → N 依次渲完即交付，不重排、不缓冲。
    //
    // `step` 的语义统一为「**已交付段数**」，每个 step 只发一次，避免重复事件：
    //   开始渲第 index 段时发 step = index —— 即"前 index 段已交付、正在渲第 index+1 段"。
    // 前端据此把 `scenes[step]` 从 queued 翻成 rendering（见 Workbench 的事件分发），
    // 进度条则用 step/total，"已交付段数"正好就是它的语义。
    for (let index = 0; index < total; index += 1) {
      send("tool_progress", { step: index, total, stage: "rendering" });
      await sleep(500 + Math.random() * 700);

      if (index === failIndex) {
        send("error", {
          scope: "step",
          index,
          message: `分镜 ${index + 1} 渲染失败：manim 退出码 1 —— FileNotFoundError: 'latex'（LaTeX 未在 PATH）`,
          retryable: true,
        });
        // 串行模型下渲染进程整体退出，后面的分镜根本轮不到执行 ——
        // 它们保持 queued 才是真实状态，不该假装继续渲染。
        break;
      }

      send("tool_result", {
        index,
        url: canned.segments[index % canned.segments.length],
        durationSec: realDuration(canned, index),
      });
    }

    if (failIndex >= 0) {
      // 有分镜失败 → 不合成成片，等用户重试那一段（Q12-B）
      send("done", { messageId: `m_${Date.now()}` });
      return;
    }

    // step 在这里已经是 total（最后一段交付后循环自然结束），只切阶段即可
    send("tool_progress", { step: total, total, stage: "concat" });
    await sleep(700);
    send("tool_done", { url: canned.final, segmentCount: total });
    send("done", { messageId: `m_${Date.now()}` });
  });
}
