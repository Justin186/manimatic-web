import Link from "next/link";
import { ArrowRight, Film, Layers, MessageSquareText, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/primitives";

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "先把思路讲清楚",
    body: "不是直接甩一个视频。AI 先用文字回答这道题在问什么，再拆成分镜大纲等你确认。",
  },
  {
    icon: Layers,
    title: "逐分镜渲染，渲好一段播一段",
    body: "分镜依次渲染、渲好即交付，第一段几秒内就能看。等待可见，不用盯着进度条发呆。",
  },
  {
    icon: Film,
    title: "某个分镜不满意就改那一个",
    body: "说一句「第三步讲慢一点」，只重做那一个分镜，其余分镜原样保留。",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-[3.85rem] max-w-6xl items-center gap-2 px-4">
          <span className="grid h-8 w-8 place-items-center rounded bg-navy-900 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-serif-cn text-base font-semibold text-navy-900">智绘课堂</span>
          <nav className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/pricing">套餐</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">登录</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/app">进入创作台</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
            <Badge tone="accent" className="mb-4">
              数学 · 讲解动画
            </Badge>
            <h1 className="max-w-3xl font-serif-cn text-4xl leading-tight text-navy-900 md:text-5xl">
              把知识点，讲成一段
              <span className="text-brick-600"> 看得懂 </span>
              的动画
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink md:text-lg">
              输入一个知识点或一道题，AI 先讲清思路、给出分镜大纲，你确认后逐分镜渲染成片。
              不满意就说一句，只改那一个分镜。
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href="/app">
                  开始生成
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#demo">看一个例子</Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-2 text-xs text-ink-soft">
              {["导数与切线", "勾股定理面积证法", "定积分几何意义", "函数变换"].map((t) => (
                <span key={t} className="rounded-full border border-line bg-canvas px-2.5 py-1">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 示例 */}
        <section id="demo" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-14">
          <h2 className="font-serif-cn text-2xl text-navy-900">真实生成的一段</h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            题目：「讲一下导数是什么」—— 4 个分镜，动点沿曲线滑动，切线实时跟随。
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-lg border border-line bg-navy-950">
              <video
                src="/demo/derivative_full.mp4"
                controls
                muted
                playsInline
                preload="metadata"
                className="aspect-video w-full"
              />
            </div>
            <ol className="space-y-2.5 text-sm">
              {[
                "抛出问题：导数到底在量什么",
                "画出 y = x² 的曲线",
                "动点滑动，切线跟随，实时显示斜率",
                "归纳：y′ = 2x",
              ].map((s, i) => (
                <li key={s} className="flex gap-2.5">
                  <span className="tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded bg-navy-900 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed text-ink">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 能力 */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-5 px-4 py-14 md:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="p-5">
                <span className="grid h-9 w-9 place-items-center rounded bg-brick-100 text-brick-700">
                  <f.icon className="h-4.5 w-4.5" />
                </span>
                <h3 className="mt-3.5 font-serif-cn text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{f.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="font-serif-cn text-2xl text-navy-900">把你手头那道题丢进来试试</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-soft">
            分镜是可编辑的：大纲能改顺序和时长，成片能按分镜重做 —— 不是一段只能重来的黑盒视频。
          </p>
          <Button size="lg" className="mt-6" asChild>
            <Link href="/app">
              进入创作台
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-6 text-xs text-ink-soft">
          <span>智绘课堂</span>
          <span className="text-line">·</span>
          <span>渲染由 Manim 确定性生成，大模型不写一行动画代码</span>
          <span className="ml-auto">2026 实训项目</span>
        </div>
      </footer>
    </div>
  );
}
