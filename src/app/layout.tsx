import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "智绘课堂 · 把知识点讲成一段动画",
  description:
    "用自然语言描述一个知识点或一道题，AI 先讲清楚思路、给出分镜大纲，确认后逐分镜渲染成讲解动画。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 思源宋体（标题）+ 思源黑体（正文）。不走 next/font 是为了避免构建期联网依赖。
            这条规则针对的是 pages router 的 _document，App Router 的 layout 里放字体链接是正常的。 */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
