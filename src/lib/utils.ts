import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `cn` —— 全站唯一的类名合并入口。
 *
 * ⚠️ 这里必须用 `extendTailwindMerge` 而不是裸的 `twMerge`，原因是：
 *    tailwind-merge 只认识它内置的那套刻度（`rounded-lg` / `rounded-full` / `duration-150` …），
 *    我们自定义的 `rounded-card` / `rounded-inner` / `rounded-bubble` / `duration-base`
 *    在它眼里是**不认识的类**，于是永远不参与冲突消除 ——
 *    `cn("rounded-card", "rounded-inner")` 会原样输出两个类，
 *    最后生效哪个完全取决于生成 CSS 的先后顺序。
 *
 *    后果是：**任何"用 className 覆盖圆角/时长"的写法都是静默失效的**。
 *    这种 bug 不报错、不报警，只表现为"这里怎么调都没反应"，
 *    正是"组件不统一"最难查的一类来源。
 *
 * 新增自定义刻度（新的 `--radius-*` / `--duration-*`）时，**必须同时加到这里**，
 * 否则它同样无法被覆盖。
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ["control", "inner", "card", "pill"] }],
      duration: [{ duration: ["fast", "base", "slow"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 秒 → "1:05" */
export function formatDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
