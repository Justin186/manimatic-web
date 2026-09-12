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
    <div className="mx-auto min-h-dvh max-w-5xl px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded bg-navy-900 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="font-serif-cn text-base font-semibold text-navy-900">Manimatic</span>
      </Link>

      <div className="text-center">
        <Badge tone="warn">演示用假支付页 · 不会产生真实扣款</Badge>
        <h1 className="mt-3 font-serif-cn text-3xl text-navy-900">按出片量计费</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-ink-soft">
          渲染是纯 CPU 的活儿（LaTeX 编译 + mobject 计算），所以成本基本跟着渲了几段走。
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p.name} className={cn("flex flex-col p-6", p.highlight && "border-brick-600")}>
            <div className="flex items-center gap-2">
              <h2 className="font-serif-cn text-lg font-semibold">{p.name}</h2>
              {p.highlight && <Badge tone="accent">推荐</Badge>}
            </div>
            <p className="mt-1 text-xs text-ink-soft">{p.desc}</p>

            <p className="mt-5 flex items-baseline gap-1">
              <span className="tnum font-serif-cn text-3xl font-semibold text-navy-900">
                {p.price}
              </span>
              <span className="text-xs text-ink-soft">{p.unit}</span>
            </p>

            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {p.items.map((it) => (
                <li key={it} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok-600" />
                  <span className="text-ink">{it}</span>
                </li>
              ))}
            </ul>

            <Button
              className="mt-6"
              variant={p.highlight ? "accent" : "outline"}
              asChild
            >
              <Link href="/app">{p.cta}</Link>
            </Button>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-ink-soft">
        配额校验在后端是一个独立函数，接入真实支付时只换那一个函数。
      </p>
    </div>
  );
}
