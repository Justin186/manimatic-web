"use client";

import { useCallback, useEffect } from "react";

import { THEME_DEFAULT, THEME_KEY, type Theme } from "./theme-shared";
import { useLocalStorage } from "./use-ui";

/**
 * 主题读写。
 *
 * 复用既有的 `useLocalStorage`（模块级 cache + `useSyncExternalStore`），
 * 所以它的 `getServerSnapshot` 天然保证首帧与服务端一致，不会撞 hydration 不匹配；
 * 同时多个组件同时用 `useTheme()` 会订阅同一个 key，改一处全站同步。
 *
 * **没有引入 `next-themes`**：项目有明确的依赖纪律（"每加一个依赖前先问 AI 熟不熟悉它"），
 * 而这里的逻辑只有几十行，且 `useLocalStorage` 已经把最麻烦的部分解决了。
 *
 * 渲染出的图标**不依赖 JS 状态**：`theme-toggle.tsx` 用 `dark:hidden` / `dark:block`
 * 两个类来切换日/月图标，所以首帧也不需要等 effect。
 */
export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>(THEME_KEY, THEME_DEFAULT);

  // 把主题落到 <html> 的 class 上：所有 `dark:` 变体与 `.dark` 令牌档都挂在这一层
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, toggle, setTheme };
}
