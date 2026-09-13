import Link from "next/link";
import { Download, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";

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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

async function loadShare(slug: string): Promise<SharePayload> {
  if (USE_MOCK) {
    // Mock 模式：没有后端可问，用预渲成片顶替（与其它 Mock 数据的做法一致）
    const isDerivative = slug.includes("derivative");
    return {
      ok: true,
      title: isDerivative ? "导数就是切线的斜率" : "一段数学讲解动画",
      subtitle: "4 个分镜 · 由 AI 生成分镜、Manim 确定性渲染",
      segments: [],
      final: {
        url: isDerivative ? "/demo/derivative_full.mp4" : "/demo/pythagorean_full.mp4",
        durationSec: 0,
      },
    };
  }

  try {
    const res = await fetch(`${API_BASE}/api/share/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `后端返回 ${res.status}` };
    return (await res.json()) as SharePayload;
  } catch {
    // 后端没起 / 地址不对。这里不要抛出，让它变成页面上一句能看懂的话 ——
    // 分享页是给别人看的，甩一个 500 页面等于把内部问题暴露给访问者。
    return { ok: false, error: "连不上后端服务" };
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-10">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded bg-navy-900 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="font-serif-cn text-base font-semibold text-navy-900">智绘课堂</span>
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
        <div className="mt-8 rounded-lg border border-line bg-surface px-5 py-6">
          <p className="text-sm font-medium text-navy-900">这个分享打不开了</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {data.error || "链接可能已被取消，或者这段内容已经不在了。"}
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/app">去做一段自己的</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  const segments = data.segments ?? [];
  const finalUrl = data.final?.url ?? "";

  return (
    <Shell>
      <h1 className="mt-6 font-serif-cn text-2xl text-navy-900">
        {data.title || "一段数学讲解动画"}
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        {data.subtitle || "由 AI 生成分镜、Manim 确定性渲染"}
      </p>

      {finalUrl ? (
        <div className="mt-6 overflow-hidden rounded-lg border border-line bg-navy-950">
          <video src={finalUrl} controls playsInline preload="metadata" className="aspect-video w-full" />
        </div>
      ) : (
        <p className="mt-6 rounded-lg border border-line bg-surface px-5 py-6 text-sm text-ink-soft">
          这条会话还没有渲染出成片，所以暂时没有视频可看。
        </p>
      )}

      {segments.length ? (
        <div className="mt-6">
          <p className="text-xs font-medium text-ink-soft">分镜</p>
          <ul className="mt-2 divide-y divide-line rounded-md border border-line bg-surface">
            {segments.map((s) => (
              <li key={s.index} className="flex items-center gap-2 px-3 py-2 text-sm text-navy-900">
                <span className="tnum w-5 shrink-0 text-xs text-ink-soft">{s.index + 1}</span>
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="tnum shrink-0 text-xs text-ink-soft">
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
