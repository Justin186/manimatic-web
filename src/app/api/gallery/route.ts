import { DERIVATIVE, PYTHAGOREAN, type Canned } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/gallery —— **Mock 模式的画廊列表**（`NEXT_PUBLIC_USE_MOCK` 默认就是 true）。
 *
 * 为什么 Mock 必须有内容：本地开发不启后端时，画廊页要是空的，看到的就是
 * 一个"功能没做"的空白页，而实际上后端接口是好的 —— 这两件事在界面上长得一样，
 * 分不清就一定误判（项目里 EmptyState 的注释反复在说同一件事）。
 *
 * 用的是 `public/demo/*.mp4` 里**真实渲出来的**成片（与落地页 Demo、预置会话同源），
 * 所以封面、悬停预览、就地播放这三条都在本地能得到真实验证，不是占位图。
 */

type MockItem = {
  threadId: string;
  title: string;
  subtitle: string;
  videoUrl: string;
  durationSec: number;
  sceneCount: number;
  publishedAt: number;
  playable: boolean;
  mine: boolean;
  author: string;
};

function toItem(c: Canned, threadId: string, publishedAt: number, mine: boolean, author: string): MockItem {
  return {
    threadId,
    title: c.title,
    subtitle: `${c.plan.length} 个分镜`,
    videoUrl: c.final,
    // 时长按真实帧时长求和 —— 与真实后端 `_share_payload` 的算法一致
    // （大纲里的设计值故意不同，用它会和时间轴对不上）
    durationSec: Math.round(c.segmentDurations.reduce((a, b) => a + b, 0) * 1000) / 1000,
    sceneCount: c.plan.length,
    publishedAt,
    playable: true,
    mine,
    author,
  };
}

/** 演示作品的时间戳：固定相对量，保证每次打开的顺序稳定（不用 Date.now，否则每次刷新都在跳） */
const HOUR = 3600_000;

export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope") ?? "all";
  const items: MockItem[] = [
    toItem(DERIVATIVE, "demo", Date.now() - 3 * HOUR, true, "演示账号"),
    toItem(PYTHAGOREAN, "t_pyth", Date.now() - 26 * HOUR, false, "林老师"),
  ];

  return Response.json({
    ok: true,
    items: scope === "mine" ? items.filter((i) => i.mine) : items,
    skipped: 0,
  });
}
