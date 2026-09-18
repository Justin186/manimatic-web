import Link from "next/link";
import { ArrowRight, Check, Film, Layers, MessageSquareText, Sparkles } from "lucide-react";

import { UserMenuButton } from "@/components/auth/UserMenuButton";
import { Button } from "@/components/ui/button";
import { DERIVATIVE } from "@/lib/mock-data";
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

/**
 * 示例区要用的几样东西，**全部从 `DERIVATIVE` 派生**。
 *
 * ⚠️ 这里的视频、分镜清单、时长，与**给模型看的 few-shot 示例 1**
 *    （`examples/fewshot_derivative.json`）是同一份内容 —— 不是巧合：
 *    首页那句"真实生成的一段"要经得起看，而且观众看到的这一段
 *    正是模型每次写分镜前都要先看一遍的示范。
 *
 * ⚠️ 所以这三样**必须**是派生值而不是手抄的常量。原来是把分镜清单和"55 秒"
 *    各手写一份，结果换质量档重渲（480p15 → 720p30，时长 55.5s → 56.9s）之后
 *    页面上的数字就全成了假话 —— 而且没有任何机制会提醒你去改。
 *    现在改演示只改 `mock-data.ts` 一处。
 */
const DEMO_VIDEO = DERIVATIVE.final;

/**
 * 首页这一栏显示的**精简概要**，与 `DERIVATIVE.plan` 一一对应（同样 5 条、同样顺序）。
 *
 * ⚠️ 为什么另写一组而不是直接用 `plan[].summary`：那一份是**给模型看的**示例原文，
 *    每条 40~60 字，在这个 451px 宽的栏里要折成 2~3 行 ——
 *    5 条下来能到 480px 高，而左边 16:9 的视频只有 381px 高（677px 宽时），
 *    于是视频列底下空一大片。折行的行数还随屏宽变，压不住。
 *
 *    首页这里要的是"能一眼扫完的五步"，不是把示例原文照搬 ——
 *    那 5 条原文留在 `mock-data.ts` 里（模型照读的那份一个字没动）。
 *
 * ⚠️ 每条压在 **31 个中文字以内**（`text-xs`、375px 行宽下正好一行）。
 *    超过就会折行，高度立刻失控 —— 改文案时请数一下字数。
 *    要更长的说明就该换个版面（比如整幅宽度铺开），而不是在这里硬塞。
 */
const DEMO_STEPS: { id: number; title: string; summary: string }[] = [
  { id: 1, title: "要求的是什么", summary: "求 y = x² 在 x = 1 处的切线斜率" },
  { id: 2, title: "先算平均变化率", summary: "再取一点连成割线，看 Δy/Δx 随 Δx 变小" },
  { id: 3, title: "每一点都有自己的斜率", summary: "割线趋近切线，旁边同步放出 y′ = 2x" },
  { id: 4, title: "正统做法：用定义算一遍", summary: "代入、展开、约分取极限，每步带注释" },
  { id: 5, title: "常用求导公式", summary: "推广成一张公式表，都是同一个定义算出来的" },
];

/**
 * 时长文案。用 `segmentDurations`（ffprobe 量的**真实帧时长**）求和，
 * 不是大纲的设计值 —— 两者故意不同，见 mock-data.ts 的说明。
 */
const DEMO_DURATION = `${Math.round(
  DERIVATIVE.segmentDurations.reduce((a, b) => a + b, 0),
)} 秒`;

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
            <Button variant="ghost" size="sm" asChild>
              <Link href="/gallery">画廊</Link>
            </Button>
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
            // 不写"4 个分镜"这类数字之外的形容：这一段的可信度来自它**能被看完**，
            // 而不是来自文案。分镜数与时长直接对上下面那张表。
            desc={`题目：「讲一下导数是什么」—— ${DEMO_STEPS.length} 个分镜、${DEMO_DURATION}，从几何直觉一路算到常用公式表。`}
          />

          {/*
            ⚠️ 两栏能对齐，靠的是**大纲每条只占一行**（见 DEMO_STEPS 的字数约束），
            不是靠调列宽比例。

            之前试过两种极端，都不对：
              · 默认 `stretch`：视频容器被拉成和大纲同高，16:9 撑不满，底下多一块黑条；
              · 加 `items-start`：不拉伸了，但大纲比视频高，左下角空一大片；
              · 视频改成独占整幅宽度：对齐是解决了，但视频**太大**，失去"一眼看到全貌"的分寸。
            根子在于原来每条概要有 2~3 行，5 条必然高过视频。

            现在两端都收住了：`items-start` 防止容器被拉伸，同时每条概要压到一行 ——
            两栏自然高度就落在同一个量级（视频列 677px 宽 → 381px 高，
            大纲列约 390px），底下不会再空。

            ⚠️ 所以改概要时**别让它折行**，折了高度就会重新失衡（见 DEMO_STEPS 的注）。

            ⚠️ 列宽 `1.75fr : 1fr` 也是配平出来的，不是随手定的比例：
            视频列 653→677px（画面变大），大纲列 435→387px（文案更紧凑），
            两栏高度差从 12px 收到 10px 以内。
            大纲列收窄后**文字宽还剩 311px（约 25 个全角）**，
            而最长的概要 20 个全角 —— 仍然一行放得下，这是这个比例还能站得住的边界。
            再往窄调（`2fr`）就会开始挤掉余量：可容字数掉到 23，
            文案稍改长一点就折行、高度立刻失衡。
          */}
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-card border border-border bg-video shadow-card">
              <video
                src={DEMO_VIDEO}
                controls
                muted
                playsInline
                preload="metadata"
                // `aspect-video` + `w-full`：高度由宽度算出来，任何屏宽下都不裁画面
                className="aspect-video w-full"
              />
            </div>

            <Card className="p-5" elevation="flat">
              <div className="flex items-center gap-2">
                <p className="font-heading text-sm font-semibold text-fg">分镜大纲</p>
                <span className="tnum text-xs text-fg-subtle">{DEMO_STEPS.length} 步</span>
              </div>
              {/*
                ⚠️ 行距 `space-y-2.5` 是**配平用的**，不是随手定的：
                按 1152px 版心算（视频列 653px → 367px 高），
                5 条各 38px + 4 个 10px 间距，加上标题与底部说明，
                右栏落在 ~375px —— 与左边差 6px 左右，肉眼看不出。
                改这个值会重新错开，要动就一起量一遍。
                （这是按字号与间距算出来的，不是浏览器实测；换个屏宽都会有几十像素的出入，
                  但两栏都在 370px 附近，不会出现之前那种几百像素的空洞。）
              */}
              <ol className="mt-4 space-y-2.5">
                {DEMO_STEPS.map((s, i) => (
                  <li key={s.id} className="flex gap-3">
                    <span className="tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-inner border border-border bg-surface-2 text-xs font-semibold text-fg-muted">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-fg">{s.title}</span>
                      {/* `truncate` 是**兜底**，不是排版手段：正常情况这一行放得下。
                          它防的是"有人改长了文案、在窄屏上折行"把两栏高度再次拉歪 ——
                          宁可截断，也不要悄悄变成一大片空白。 */}
                      <span className="mt-0.5 block truncate text-xs text-fg-muted">
                        {s.summary}
                      </span>
                    </span>
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
