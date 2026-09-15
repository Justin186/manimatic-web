/**
 * 主题的共享常量。
 *
 * ⚠️ 这个文件**不能**加 `"use client"`：`THEME_SCRIPT` 要给 `layout.tsx`（服务端组件）
 *    当内联脚本用。从 "use client" 模块 import 一个值，拿到的会是"客户端引用"而不是字符串本身。
 *
 * ⚠️ `THEME_KEY` 必须与 `THEME_SCRIPT` 里写死的那个 key 一致 —— 内联脚本在
 *    React 之前运行，拿不到这个常量，只能两边手写同一个字符串。
 */

export type Theme = "light" | "dark";

/** 主题偏好的 localStorage key。值由 `useLocalStorage` 以 JSON 形式写入（`"dark"` 带引号）。 */
export const THEME_KEY = "ui.theme";

/** 默认主题。产品定的是"默认亮色，深色作为可选项"，所以这里**不跟随系统**。 */
export const THEME_DEFAULT: Theme = "light";

/**
 * 防白闪脚本：在样式生效之前就把 `class="dark"` 写到 `<html>` 上。
 *
 * 为什么不放在 React 里做：那要等到 hydration 之后才生效，
 * 暗色用户会先看到一帧全白 —— 在暗色下这一帧非常刺眼。
 *
 * 容错：localStorage 可能不可用（隐私模式 / CSP 拦内联脚本），
 * 所以整段包在 try 里；失败就退化成"默认亮色 + 挂载后再切"，只闪一次，不影响功能。
 */
export const THEME_SCRIPT = [
  "(function(){",
  "try{",
  'var v=localStorage.getItem("ui.theme");',
  "if(!v)return;",
  "var t=v;try{t=JSON.parse(v)}catch(e){}",
  'if(t==="dark")document.documentElement.classList.add("dark");',
  "}catch(e){}",
  "})();",
].join("");
