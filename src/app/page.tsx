import Link from "next/link";
import { ArrowRight, Check, Film, Layers, MessageSquareText, Sparkles } from "lucide-react";

import { UserMenuButton } from "@/components/auth/UserMenuButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/primitives";
import { SectionHeading } from "@/components/ui/section";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "先把思路讲清楚",
    body: "不是直接甩一个视频。AI 先用文字回答这道题在问什么，再拆成分镜大纲等你确认。",
  },
  {
    icon: Layers,
    title: "逐分镜渲染，渲好一段播一段",
    body: "分镜依次渲染，第一段几秒内就能看 —— 不用等整条做完，也不用盯着进度条发呆。",
  },
  {
    icon: Film,
    title: "某个分镜不满意就改那一个",
    body: "说一句「第三步讲慢一点」，只重做那一个分镜，其余分镜原样保留。",
  },
];

/**
 * 示例选题。
 *
 * 挑的是**能被几何化表达**的东西，不是"学科覆盖率"：
 * 渲染出来的是确定性的几何动画，所以适配的是有明确图形对象、能拆成步骤的内容
 * （函数图像、受力、运动轨迹、区间收缩）；靠意境或分子机制推进的题材落不到可画的实体上，
 * 摆在这里只会让人点进去发现"做出来并不是这样"。
 *
 * 学科上刻意跨三类 —— 只摆数学题会把"这是个数学工具"说死。
 */
const EXAMPLES = ["导数与切线", "牛顿第二定律", "抛体运动", "二分查找"];

/** 示例视频下的分镜清单：与 `/demo/derivative_full.mp4` 是同一段内容 */
const DEMO_STEPS = [
  "抛出问题：导数到底在量什么",
  "画出 y = x² 的曲线",
  "动点滑动，切线跟随，实时显示斜率",
  "归纳：y′ = 2x",
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* 顶栏：毛玻璃吸顶。落地页是长滚动页，吸顶栏要能"浮"在内容之上而不是切一刀 */}
      <header className="t-glass sticky top-0 z-20 border-b border-border">
        <div className="page-shell flex h-14 items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="t-grad grid h-7 w-7 place-items-center rounded-control text-accent-fg">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="font-display text-base font-semibold text-fg">智绘课堂</span>
          </Link>

          <nav className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/pricing">套餐</Link>
            </Button>
            <ThemeToggle size="sm" />
            {/*
              ⚠️ 这里原来是写死的「登录」按钮 —— 登录了也写着"登录"，
                 让人以为登录没生效。现在整块交给 UserMenuButton：
                 未登录 = 登录按钮，已登录 = 头像 + 菜单（含管理后台入口）。
                 这个组件与工作台 TopBar 共用，两处不会再各说各话。
            */}
            <UserMenuButton size="sm" />
            <Button size="sm" variant="grad" asChild>
              <Link href="/app">进入创作台</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ------------------------------ Hero ------------------------------ */}
        <section className="relative overflow-hidden border-b border-border">
          {/* 品牌光晕：给首屏一个视觉落点。走 t-glow 而不是内联渐变，
              暗色档会自动换成提亮后的版本 */}
          <div aria-hidden className="t-glow pointer-events-none absolute inset-0" />

          <div className="page-shell relative py-16 text-center md:py-24">
            <Badge tone="neutral" className="mb-5">
              <Sparkles className="h-3 w-3" />
              任意学科 · 讲解动画
            </Badge>

            {/*
              ⚠️ `text-balance` 和 `whitespace-nowrap` 缺一不可，它们解决的是**两个不同**的问题：

              1. `whitespace-nowrap`：中文可以**在任意两个字之间**换行，不加的话
                 「讲成一段」会被拆成「讲成一 / 段」，高亮词组断成两截。
                 也**不要**在这两处加空格 —— 英文空格既是可见的间隙，又是一个额外的换行点。

              2. `text-balance`：光有 nowrap 只会让换行点少一个，浏览器依然是"贪心填满第一行"，
                 结果是 13 个字挤在第一行、最后一个「画」孤零零掉在第二行。
                 `balance` 让两行尽量等宽，换行点又只能落在高亮词组的两侧，
                 于是稳定得到「把知识点讲成一段 / 看得懂的动画」。
            */}
            <h1 className="mx-auto max-w-2xl text-balance font-display text-4xl leading-tight font-bold tracking-tight text-fg md:text-5xl">
              把知识点
              <span className="t-grad bg-clip-text whitespace-nowrap text-transparent">
                讲成一段
              </span>
              看得懂的动画
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-fg-muted">
              输入一个知识点或一道题，AI 先讲清思路、给出分镜大纲，你确认后逐分镜渲染成片。
              不满意就说一句，只改那一个分镜。
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" variant="grad" asChild>
                <Link href="/app">
                  开始生成
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#demo">看一个例子</Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((t) => (
                <span
                  key={t}
                  className="t-tx rounded-pill border border-border bg-surface px-3 py-1 text-xs text-fg-muted shadow-card hover:border-accent hover:text-accent"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------ 示例 ------------------------------ */}
        <section id="demo" className="page-shell scroll-mt-20 py-16">
          <SectionHeading
            eyebrow="Demo"
            title="真实生成的一段"
            desc="题目：「讲一下导数是什么」—— 4 个分镜，动点沿曲线滑动，切线实时跟随。"
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-card border border-border bg-video shadow-card">
              <video
                src="/demo/derivative_full.mp4"
                controls
                muted
                playsInline
                preload="metadata"
                className="aspect-video w-full"
              />
            </div>

            <Card className="p-5" elevation="flat">
              <p className="font-heading text-sm font-semibold text-fg">分镜大纲</p>
              <ol className="mt-4 space-y-3">
                {DEMO_STEPS.map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-inner border border-border bg-surface-2 text-xs font-semibold text-fg-muted">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-fg-muted">{s}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 flex items-start gap-1.5 border-t border-border pt-4 text-xs leading-relaxed text-fg-subtle">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                分镜是可编辑的 —— 顺序和时长都能改，改完再开始渲染。
              </p>
            </Card>
          </div>
        </section>

        {/* ------------------------------ 能力 ------------------------------ */}
        <section className="border-y border-border bg-surface">
          <div className="page-shell py-16">
            <SectionHeading
              title="它不是一个黑盒视频生成器"
              desc="回答、大纲、渲染、改分镜，每一步都在你能看到、能动手的地方。"
            />
            {/* 同套餐页：走全站统一的 `.card-grid`，列宽是比例而不是像素 */}
            <div className="card-grid mt-8">
              {FEATURES.map((f) => (
                <Card key={f.title} className="p-5" elevation="raised">
                  <span className="grid h-10 w-10 place-items-center rounded-inner border border-border bg-surface-2 text-fg-muted">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-heading text-base font-semibold text-fg">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{f.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------ CTA ------------------------------ */}
        <section className="relative overflow-hidden">
          {/*
            这里原先还铺了一层品牌光晕。但一页里铺两处大面积橙（Hero + 这里），
            橙就从"视觉落点"退化成了"底色"，后面真正的信号（进行中、选中、主 CTA）
            全都跳不出来了 —— 光晕只留 Hero 那一处。
          */}
          <div className="page-shell relative py-20 text-center">
            <h2 className="mx-auto max-w-xl text-balance font-display text-3xl font-bold tracking-tight text-fg">
              把你手头那道题丢进来试试
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-fg-muted">
              分镜是可编辑的：大纲能改顺序和时长，成片能按分镜重做 ——
              不是一段只能重来的黑盒视频。
            </p>
            <Button size="lg" variant="grad" className="mt-7" asChild>
              <Link href="/app">
                进入创作台
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="page-shell flex flex-wrap items-center gap-3 py-6 text-xs text-fg-subtle">
          <span>智绘课堂</span>
          <span className="text-border">·</span>
          {/* 这里本来写的是"渲染由确定性几何引擎生成，大模型不写一行动画代码"。
              那个"精确"的卖点是真的，但说法是给同行听的 —— 用户关心的是画面会不会走样。 */}
          <span>动画由几何计算生成，图形精确、不会走样</span>
          <span className="ml-auto">2026 实训项目</span>
        </div>
      </footer>
    </div>
  );
}
