import { realDuration } from "@/lib/mock-data";

import { clearFailure, recallCanned, sleep, sse } from "../../_stream";

export const dynamic = "force-dynamic";

/**
 * POST /api/render/retry —— 从失败的分镜起重跑。
 *
 * ⚠️ 语义在 2026-09-12 随后端契约调整（见 docs/分镜实时交付-契约与前端改造.md §4.1）：
 * 后端现在是「一个 Scene 演到底」，某个分镜抛异常 → 渲染进程整体退出，
 * **后面还没渲的分镜根本没执行过**。所以这里必须重跑 `scene_index` **及其后所有段落**，
 * 只补那一段会让后续分镜永远停在"排队中"，而成片又是拼好的 —— 状态自相矛盾。
 *
 * 对前端而言交互不变（点重试 → 那一段变回 queued → 重新交付），
 * 但会连续收到多段 `tool_result`，按 index 覆盖即可（幂等）。
 *
 * > 真后端在串行模型下其实是"整条重跑"（13s 可控），返回的段落会更全；
 * > 前端不用区分这两种情况。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    thread_id?: string;
    scene_index?: number;
    plan?: { durationSec?: number }[];
  };
  const threadId = body.thread_id ?? "demo";
  const from = Math.max(0, body.scene_index ?? 0);
  const canned = recallCanned(threadId);
  const total = Math.max(1, body.plan?.length || canned.segments.length);

  return sse(async (send) => {
    send("tool_progress", { step: from, total, stage: "rendering" });

    // 从失败那一段起，把剩余分镜按顺序重新交付
    for (let index = from; index < total; index += 1) {
      await sleep(900 + Math.random() * 700);
      send("tool_result", {
        index,
        url: canned.segments[index % canned.segments.length],
        // 与 confirm 一致：给真实帧时长，否则时间轴会在重试后跳一下
        durationSec: realDuration(canned, index),
      });
      send("tool_progress", { step: index + 1, total, stage: "rendering" });
    }

    // 这一段修好了才算全部通过；否则等用户继续点重试
    const allClear = clearFailure(threadId, from);
    if (allClear) {
      send("tool_progress", { step: total, total, stage: "concat" });
      await sleep(600);
      send("tool_done", { url: canned.final, segmentCount: total });
    }
    send("done", { messageId: `m_${Date.now()}` });
  });
}
