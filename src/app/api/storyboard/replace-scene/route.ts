import { realDuration } from "@/lib/mock-data";

import { recallCanned, sleep, sse } from "../../_stream";

export const dynamic = "force-dynamic";

/**
 * POST /api/storyboard/replace-scene —— 整分镜替换（Q16）。
 *
 * 真实实现里后端会让模型重新输出**一个完整的分镜对象**（不是文本 patch，
 * 因为 duration 与 timeline.run_time 耦合，只改一处会改出"动画演完干等"的半吊子），
 * 校验后只重渲这一个分镜。产物复用同一个 task 目录。
 *
 * ⚠️ 注意与 `tool_result` 时长的配合：请求里的 `durationSec` 是**用户期望的新时长**
 * （模型按它重排 timeline），而返回的 `durationSec` 必须是**重渲后的真实帧时长** ——
 * 两者通常不等（run_time 只能是帧的整数倍）。时间轴要用后者，否则定位会漂。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    thread_id?: string;
    scene_index?: number;
    instruction?: string;
    durationSec?: number;
  };
  const threadId = body.thread_id ?? "demo";
  const index = body.scene_index ?? 0;
  const canned = recallCanned(threadId);

  return sse(async (send) => {
    send("tool_progress", { step: 1, total: 1, stage: "rendering" });
    await sleep(1600);
    send("tool_result", {
      index,
      url: canned.segments[index % canned.segments.length],
      durationSec: realDuration(canned, index, body.durationSec ?? 8),
    });
    send("tool_done", { url: canned.final, segmentCount: 4 });
    send("done", { messageId: `m_${Date.now()}` });
  });
}
