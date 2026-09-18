import { DERIVATIVE, PYTHAGOREAN, type Canned } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/gallery/:threadId —— Mock 模式的**单条作品**（含分段）。
 *
 * 与列表接口（`../route.ts`）分开是刻意的，和真实后端的形态一致：
 * 网格里几十张卡不该在列表响应里各拖一份分镜清单，
 * 分段只在该卡被点开时才来取这个接口。
 */

function detailFor(c: Canned, threadId: string, mine: boolean, author: string) {
  return {
    threadId,
    title: c.title,
    subtitle: `${c.plan.length} 个分镜`,
    segments: c.plan.map((p, i) => ({
      index: i,
      title: p.title,
      url: c.segments[i % c.segments.length],
      // 真实帧时长（与 /api/render/* 的 Mock 用的是同一个来源 realDuration）
      durationSec: c.segmentDurations[i % c.segmentDurations.length],
    })),
    final: {
      url: c.final,
      durationSec:
        Math.round(c.segmentDurations.reduce((a, b) => a + b, 0) * 1000) / 1000,
    },
    publishedAt: Date.now() - 3 * 3600_000,
    mine,
    author,
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await ctx.params;

  if (threadId === PYTHAGOREAN.key || threadId === "t_pyth") {
    return Response.json({ ok: true, item: detailFor(PYTHAGOREAN, threadId, false, "林老师") });
  }
  if (threadId === DERIVATIVE.key || threadId === "demo") {
    return Response.json({ ok: true, item: detailFor(DERIVATIVE, threadId, true, "演示账号") });
  }
  // 真后端对"没发布的作品"也是这个话术：不区分"不存在"与"没发布"，
  // 免得变成一个"拿 thread_id 试探别人有哪些会话"的接口。
  return Response.json({ ok: false, error: "这条作品不在画廊里" });
}
