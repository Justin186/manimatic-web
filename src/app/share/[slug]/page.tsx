import Link from "next/link";
import { Download, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";

/** 分享页：公开，无需登录 */
export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const isDerivative = slug.includes("derivative");

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-10">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded bg-navy-900 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="font-serif-cn text-base font-semibold text-navy-900">Manimatic</span>
        <Badge className="ml-auto">公开分享</Badge>
      </div>

      <h1 className="mt-6 font-serif-cn text-2xl text-navy-900">
        {isDerivative ? "导数就是切线的斜率" : "一段数学讲解动画"}
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        4 个分镜 · 由 AI 生成分镜、Manim 确定性渲染
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-line bg-navy-950">
        <video
          src={isDerivative ? "/demo/derivative_full.mp4" : "/demo/pythagorean_full.mp4"}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button asChild>
          <a href={isDerivative ? "/demo/derivative_full.mp4" : "/demo/pythagorean_full.mp4"} download>
            <Download className="h-4 w-4" />
            下载 MP4
          </a>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/app">也来做一段</Link>
        </Button>
      </div>
    </div>
  );
}
