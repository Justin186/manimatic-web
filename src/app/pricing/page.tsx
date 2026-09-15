import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "体验",
    price: "0",
    unit: "次 / 天",
    desc: "先看看效果对不对得上你的题",
    items: ["每天 3 段", "480p", "分镜可编辑"],
    cta: "当前方案",
    highlight: false,
  },
  {
    name: "标准",
    price: "39",
    unit: "元 / 月",
    desc: "日常错题讲解，够用",
    items: ["每月 120 段", "720p24", "逐分镜重做", "分享链接"],
    cta: "选择标准版",
    highlight: true,
  },
  {
    name: "班级",
    price: "199",
    unit: "元 / 月",
    desc: "教师备课时批量出片",
    items: ["每月 800 段", "1080p", "课件导出", "多账号"],
    cta: "联系开通",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="page-shell min-h-dvh py-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="t-grad grid h-8 w-8 place-items-center rounded-control text-accent-fg">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="font-display text-base font-semibold text-fg">智绘课堂</span>
      </Link>

      {/*
        文案纪律：这一页只讲**用户能得到什么**，不讲我们是怎么做出来的。
        （原先这里写的是"渲染是纯 CPU 的活儿（LaTeX 编译 + mobject 计算）"——
         那是给同事看的实现说明，用户不关心，也看不懂。）
      */}
      <div className="text-center">
        <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-fg">
          按出片量计费
        </h1>
        <p className="text-balance mx-auto mt-3 max-w-xl text-sm leading-relaxed text-fg-muted">
          三档的差别只在每月能出多少段、清晰度和导出方式，创作功能完全一样。
        </p>
      </div>

      {/* 卡片排布走全站统一的 `.card-grid`（定义在 globals.css）：
          列宽是**比例**，不是像素区间 ——
          视口变宽卡片跟着变宽，不会被卡在某个固定宽度上；
          只有一列窄到不足 20rem 时才减列。 */}
      <div className="card-grid mt-10">
        {PLANS.map((p) => (
          <Card
            key={p.name}
            // 推荐档用 ring 而不是覆盖 border-color：两者都是 `border-color` 工具类时，
            // 谁生效取决于生成 CSS 的先后顺序（不可控），ring 则不会冲突。
            elevation={p.highlight ? "flat" : "card"}
            className={cn("flex flex-col p-5", p.highlight && "ring-2 ring-accent")}
          >
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-base font-semibold text-fg">{p.name}</h2>
              {p.highlight && <Badge tone="accent">推荐</Badge>}
            </div>
            <p className="mt-1 text-xs text-fg-muted">{p.desc}</p>

            {/*
              价格走**展示级**衬线：数字是这一页的主角，衬线体的字面对比能把它托起来。
              配合 `tnum` 让三档价格纵向对齐（等宽数字）。
            */}
            <p className="tnum mt-4 flex items-baseline gap-1">
              <span className="font-display text-3xl font-semibold text-fg">{p.price}</span>
              <span className="text-xs text-fg-subtle">{p.unit}</span>
            </p>

            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {p.items.map((it) => (
                <li key={it} className="flex items-start gap-1.5 text-fg-muted">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                  {it}
                </li>
              ))}
            </ul>

            {/*
              ⚠️ `w-full` 不能省。不加的话按钮宽度跟着文字长度走，
              三张卡里就是三个宽度 —— 一排卡片底边参差，比"按钮偏窄"更显廉价。
            */}
            <Button className="mt-5 w-full" variant={p.highlight ? "grad" : "outline"} asChild>
              <Link href="/app">{p.cta}</Link>
            </Button>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-fg-muted">
        不确定选哪档？
        <Link
          href="/app"
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          先去跑两道题
        </Link>
        ，觉得合适再升级。
      </p>
    </div>
  );
}
