"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/theme";
import { IconButton } from "./icon-button";

/**
 * 主题切换。
 *
 * ⚠️ 两个图标**同时渲染**，靠 `dark:hidden` / `hidden dark:block` 决定谁可见。
 *    刻意不用 `theme === "dark" ? <Sun/> : <Moon/>`：
 *    那样首帧只能渲染服务端快照（light），暗色用户会看到图标先是一轮月亮、
 *    hydration 之后再跳成太阳。纯 CSS 判断没有这个问题，也不需要等 effect。
 */
export function ThemeToggle({ size = "md" }: { size?: "sm" | "md" }) {
  const { toggle } = useTheme();

  return (
    <IconButton label="切换亮色 / 暗色主题" size={size} onClick={toggle}>
      {/* 亮色下显示月亮（点了会变暗），暗色下显示太阳 */}
      <Moon className="h-4 w-4 dark:hidden" />
      <Sun className="hidden h-4 w-4 dark:block" />
    </IconButton>
  );
}
