import type { Metadata } from "next";

import { ToastProvider } from "@/components/ui/toast";
import { THEME_SCRIPT } from "@/lib/theme-shared";

import "./globals.css";

export const metadata: Metadata = {
  title: "智绘课堂 · 把知识点讲成一段动画",
  description:
    "用自然语言描述一个知识点或一道题，AI 先讲清楚思路、给出分镜大纲，确认后逐分镜渲染成讲解动画。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * `suppressHydrationWarning` 必须加在 <html> 上：
     * head 里那段内联脚本会在 hydration **之前**给 documentElement 加 `dark` class，
     * 服务端产出的 HTML 里没有这个属性 —— React 会把这判定为属性不匹配。
     * 这是"脚本先于 React 改 DOM"的官方豁免场景。
     */
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/*
          防白闪：在任何样式生效前把 `class="dark"` 写到 <html>。
          必须放在 head 的最前面 —— 放到后面会出现"先白一帧再变暗"。
          脚本本身在 lib/theme-shared.ts，与 useTheme 共用同一个 storage key。
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          思源宋体（展示级标题）+ 思源黑体（正文与功能级标题）。
          不走 next/font 是为了避免构建期联网依赖。
          这条规则针对的是 pages router 的 _document，App Router 的 layout 里放字体链接是正常的。

          ⚠️ Noto Sans SC 必须请求**可变字重区间**（`wght@100..900`），不能只写离散档。
          原因：系统中文栈（Windows 的微软雅黑）只有 Regular 与 Bold 两个字重，
          501~699 之间的任何值都会被浏览器向上吸附成 Bold ——
          于是"比 medium 稍微粗一点"这个需求在系统字体上根本表达不出来。
          换成可变字体后，550 这类中间字重才真实存在（详见 §9.3）。

          代价可控：Google Fonts 对 CJK 会按 `unicode-range` 切成很多小分片，
          浏览器只下载页面**实际用到**的字所在的分片，不是整套中文字体。
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;600;700&family=Noto+Sans+SC:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-full flex-col">
        {/* 轻提示挂在根布局而不是某个页面里：它是全局能力，
            放这里任何客户端组件都能直接 useToast()，不必再各自造一个浮层 */}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
