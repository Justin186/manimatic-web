import Link from "next/link";
import { Download, Link2Off, Sparkles } from "lucide-react";

import { mediaUrl } from "@/lib/api";
import { DERIVATIVE, PYTHAGOREAN } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/section";

/**
 * 分享页：公开，无需登录。
 *
 * 数据从后端 `/api/share/<slug>` 取。那个接口**只回标题、成片和分段清单，不回对话
 * 文字** —— 会话里可能有用户的问题原文和追问，分享的语义是"这段视频给你看"，
 * 不是"把我的对话记录也给你看"。
 *
 * ⚠️ 这是服务端组件，直接 fetch 后端，不走浏览器那套 `USE_MOCK` 分支。
 *    所以 Mock 模式（没有后端）下这里回落到 `public/demo` 的预渲成片 ——
 *    演示时这个页面不该是白的。
 *
 * ⚠️ 必须 force-dynamic：分享可以随时取消，缓存住一个已经取消的分享链接
 *    比 404 更糟（用户会以为"还能看"）。
 *
 * ⚠️ 服务端组件不接客户端 hook，所以这里的**主题跟随是"免费"的**：
 *    它渲染在 `<html class="dark">` 之下，语义令牌（`bg-surface` / `text-fg` …）
 *    会自己算出暗色值。不要为了主题在这里加 `useTheme`。
 */

export const dynamic = "force-dynamic";

type SharePayload = {
  ok: boolean;
  error?: string;
  thread_id?: string;
  title?: string;
  subtitle?: string;
  segments?: { index: number; title: string; url: string; durationSec: number }[];
  final?: { url: string; durationSec: number } | null;
};

/**
 * 服务端取数必须用**绝对地址**：Node 的 fetch 不认相对路径，
 * 而 `NEXT_PUBLIC_API_BASE_URL` 现在是同源前缀 `/msb`（见 .env.local），用不了。
 */
const SERVER_API = process.env.MSB_API_INTERNAL_URL ?? "http://127.0.0.1:8000";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

async function loadShare(slug: string): Promise<SharePayload> {
  if (USE_MOCK) {
    // Mock 模式：没有后端可问，用预渲成片顶替（与其它 Mock 数据的做法一致）
    // ⚠️ 标题、分镜数、地址全部从 DERIVATIVE / PYTHAGOREAN 派生，不再手写 ——
    //    手写的那份抄的是旧的四分镜演示，而视频早换成了 5 镜的 few-shot 示例，
    //    于是分享页会显示"4 个分镜"配一段 5 镜的视频。
    const isDerivative = slug.includes("derivative");
    const c = isDerivative ? DERIVATIVE : PYTHAGOREAN;
    return {
      ok: true,
      title: c.title,
      subtitle: `${c.plan.length} 个分镜 · 由 AI 生成分镜、逐段渲染成片`,
      segments: [],
      final: {
        url: c.final,
        // 用真实帧时长之和（与真实后端 `_share_payload` 的算法一致）
        durationSec: Math.round(c.segmentDurations.reduce((a, b) => a + b, 0) * 10) / 10,
      },
    };
  }

  try {
    const res = await fetch(`${SERVER_API}/api/share/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      // 页面上的话给人看，状态码给日志看 —— 别把 502 甩到分享链接的访问者脸上
      console.error(`[share] 拉取 ${slug} 失败：后端返回 ${res.status}`);
      return { ok: false, error: "这段内容暂时打不开，稍后再试试。" };
    }
    const payload = (await res.json()) as SharePayload;
    // 后端回的成片地址是 http://localhost:8000/media/... —— 观众多半不在服务器那台机器上，
    // 这个 localhost 指他自己。换成同源地址，让浏览器走 Next 的 /msb 代理取。
    return {
      ...payload,
      segments: payload.segments?.map((s) => ({ ...s, url: mediaUrl(s.url) })),
      final: payload.final ? { ...payload.final, url: mediaUrl(payload.final.url) } : payload.final,
    };
  } catch (e) {
    // 后端没起 / 地址不对。这里不要抛出，让它变成页面上一句能看懂的话 ——
    // 分享页是给别人看的，甩一个 500 页面等于把内部问题暴露给访问者。
    console.error(`[share] 连不上后端，slug=${slug}`, e);
    return { ok: false, error: "暂时连不上服务，稍后再试试。" };
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    // 这一页主体是 16:9 的成片，容器越窄视频越小 —— 走全站统一的 .page-shell
    <div className="page-shell min-h-dvh py-10">
      <div className="flex items-center gap-2">
        <span className="t-grad grid h-8 w-8 place-items-center rounded-control text-accent-fg">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="font-display text-base font-semibold text-fg">智绘课堂</span>
        <Badge className="ml-auto">公开分享</Badge>
      </div>
      {children}
    </div>
  );
}

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadShare(slug);

  if (!data.ok) {
    return (
      <Shell>
        {/*
          错误态用和空态同一套结构（图标 + 一句定性 + 一句可操作的解释）：
          "打不开了"和"还没有东西"对用户是同一类处境，长得一样才不费解。
        */}
        <div className="mt-8 rounded-card border border-border bg-surface shadow-card">
          <EmptyState
            className="py-10"
            icon={<Link2Off className="h-5 w-5" />}
            title="这个分享打不开了"
            desc={data.error || "链接可能已被取消，或者这段内容已经不在了。"}
            action={
              <Button variant="outline" size="sm" className="mt-1" asChild>
                <Link href="/app">去做一段自己的</Link>
              </Button>
            }
          />
        </div>
      </Shell>
    );
  }

  const segments = data.segments ?? [];
  const finalUrl = data.final?.url ?? "";

  return (
    <Shell>
      <h1 className="text-balance mt-6 font-display text-2xl font-bold tracking-tight text-fg">
        {data.title || "一段讲解动画"}
      </h1>
      <p className="mt-2 text-sm text-fg-muted">
        {data.subtitle || "由 AI 生成分镜、逐段渲染成片"}
      </p>

      {finalUrl ? (
        // 视频底用 `--t-video`：两套主题下都是深色，播放前后不会出现"白块闪一下"
        <div className="mt-6 overflow-hidden rounded-card border border-border bg-video shadow-card">
          <video
            src={finalUrl}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full"
          />
        </div>
      ) : (
        <div className="mt-6 rounded-card border border-border bg-surface shadow-card">
          <EmptyState
            className="py-8"
            icon={<Sparkles className="h-5 w-5" />}
            title="还没有成片"
            desc="这条会话还没渲染出成片，所以暂时没有视频可看。"
          />
        </div>
      )}

      {segments.length ? (
        <div className="mt-6">
          <p className="text-xs font-medium text-fg-muted">分镜</p>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-inner border border-border bg-surface">
            {segments.map((s) => (
              <li key={s.index} className="flex items-center gap-2 px-3 py-2 text-sm text-fg">
                <span className="tnum w-5 shrink-0 text-xs text-fg-subtle">{s.index + 1}</span>
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="tnum shrink-0 text-xs text-fg-muted">
                  {s.durationSec.toFixed(1)}s
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {finalUrl ? (
          <Button asChild>
            <a href={finalUrl} download>
              <Download className="h-4 w-4" />
              下载 MP4
            </a>
          </Button>
        ) : null}
        <Button variant="outline" asChild>
          <Link href="/app">也来做一段</Link>
        </Button>
      </div>
    </Shell>
  );
}
