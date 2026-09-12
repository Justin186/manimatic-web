import type { PlanStep, Thread } from "./types";

/**
 * Mock 数据。
 *
 * 视频用的是**你们自己渲出来的真画面**（从 ../MathStoryboard/output 拷到 public/demo）：
 *   derivative_s0~s3   = free_derivative 的 4 个分镜片段（--parallel 逐分镜渲染产物）
 *   pythagorean_s0~s3  = free_pythagorean 成片按分镜时长切分
 * 所以演示里"分镜级进度 + 逐段播放"看到的是真实效果，不是占位图。
 *
 * ⚠️ `segmentDurations` 是 ffprobe 量出来的**真实帧时长**，语义等价于后端
 * `sections/index.json` 的 `duration`（manim 按真实帧数算的）。
 * 它和 `plan[].durationSec`（大纲设计值）**故意不同** —— 前端必须用前者铺时间轴，
 * 否则分镜定位会漂（见 docs/分镜实时交付-契约与前端改造.md §2）。
 */

export type Canned = {
  key: string;
  match: RegExp;
  title: string;
  brief: string;
  plan: PlanStep[];
  segments: string[];
  /** 与 segments 一一对应的真实帧时长（秒）—— 等价于后端 index.json 的 duration */
  segmentDurations: number[];
  final: string;
  intent: "propose" | "none";
};

export const DERIVATIVE: Canned = {
  key: "derivative",
  match: /导数|切线|斜率|求导|derivative/i,
  title: "导数就是切线的斜率",
  brief:
    "导数描述的是「变化有多快」。对 y = x² 来说，函数在 x 处的导数就是曲线在那一点切线的斜率；代入求导公式可得 y′ = 2x。所以 x = -1 时斜率为 -2，x = 0 时为 0，x = 3 时为 6 —— 切线会跟着点一起转动。",
  plan: [
    { id: 1, title: "抛出问题", durationSec: 4.5, summary: "导数到底在量什么？先给一句直觉解释" },
    { id: 2, title: "画出抛物线", durationSec: 9, summary: "在坐标系上画出 y = x²，标出坐标轴" },
    { id: 3, title: "动点 + 切线", durationSec: 13, summary: "一个点沿曲线滑动，切线实时跟随，右上角显示当前斜率" },
    { id: 4, title: "归纳结论", durationSec: 6, summary: "y′ = 2x，斜率随 x 线性变化" },
  ],
  segments: [
    "/demo/derivative_s0.mp4",
    "/demo/derivative_s1.mp4",
    "/demo/derivative_s2.mp4",
    "/demo/derivative_s3.mp4",
  ],
  // ffprobe 实测：5.199 / 14.333 / 10.733 / 6.667（合计 36.93s）
  // 对照大纲设计值 4.5 / 9 / 13 / 6（合计 32.5s）—— 差异正是"必须用真实时长"的理由
  segmentDurations: [5.199333, 14.333333, 10.733008, 6.666667],
  final: "/demo/derivative_full.mp4",
  intent: "propose",
};

export const PYTHAGOREAN: Canned = {
  key: "pythagorean",
  match: /勾股|直角三角|毕达哥拉斯|a2.*b2.*c2/i,
  title: "勾股定理：面积证法",
  brief:
    "勾股定理说的是：直角三角形两条直角边的平方和等于斜边的平方，即 a² + b² = c²。最直观的证明是面积法 —— 把三边各自向外做一个正方形，两个小正方形的面积之和正好等于大正方形。",
  plan: [
    { id: 1, title: "提出问题", durationSec: 4.5, summary: "为什么 a² + b² = c²？" },
    { id: 2, title: "画直角三角形", durationSec: 9, summary: "取 3-4-5 直角三角形，标出直角与顶点 A/B/C" },
    { id: 3, title: "三边各做正方形", durationSec: 13, summary: "分别标出面积 9、16、25" },
    { id: 4, title: "得出结论", durationSec: 6, summary: "两个小正方形之和正好等于大正方形" },
  ],
  segments: [
    "/demo/pythagorean_s0.mp4",
    "/demo/pythagorean_s1.mp4",
    "/demo/pythagorean_s2.mp4",
    "/demo/pythagorean_s3.mp4",
  ],
  // ffprobe 实测：4.533 / 9.0 / 13.067 / 6.0（合计 32.6s）
  segmentDurations: [4.533333, 9.0, 13.066667, 6.0],
  final: "/demo/pythagorean_full.mp4",
  intent: "propose",
};

/** 纯概念问答：模型判断不该出动画 → intent: none（对应 Q15） */
function conceptAnswer(q: string): Canned {
  return {
    key: "concept",
    match: /.*/,
    title: q.slice(0, 24),
    brief:
      "这是个概念问题，用文字说清楚比动画更快 —— 所以我这次不生成视频。如果你想要一段讲解动画，直接把具体的题目发给我（比如「求 f(x)=x³-3x 的极值」）。",
    plan: [],
    segments: [],
    segmentDurations: [],
    final: "",
    intent: "none",
  };
}

export function pickCanned(question: string): Canned {
  if (DERIVATIVE.match.test(question)) return DERIVATIVE;
  if (PYTHAGOREAN.match.test(question)) return PYTHAGOREAN;
  return conceptAnswer(question);
}

/**
 * 取某一段的**真实帧时长**（秒）。
 *
 * 真后端从 `sections/index.json` 读，Mock 从 `segmentDurations` 读 ——
 * 两边语义一致，都是"按真实帧数算出来的时长"，前端不该碰大纲的设计值。
 */
export function realDuration(canned: Canned, index: number, fallback = 6): number {
  const list = canned.segmentDurations;
  if (list.length === 0) return fallback;
  return list[((index % list.length) + list.length) % list.length];
}

export const SEED_THREADS: Thread[] = [
  {
    id: "demo",
    title: "导数就是切线的斜率",
    subtitle: "4 个分镜 · 已出片",
    updatedAt: Date.now() - 1000 * 60 * 12,
  },
  {
    id: "t_pyth",
    title: "勾股定理：面积证法",
    subtitle: "4 个分镜 · 草稿",
    updatedAt: Date.now() - 1000 * 60 * 60 * 3,
  },
  {
    id: "t_quad",
    title: "二次函数的最值问题",
    subtitle: "待生成",
    updatedAt: Date.now() - 1000 * 60 * 60 * 26,
  },
];

export const QUICK_PROMPTS = [
  "讲一下导数是什么",
  "用面积法证明勾股定理",
  "求 f(x)=x³-3x 的单调区间与极值",
];
