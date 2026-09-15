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
  /**
   * 模拟"深度思考"的推理过程（可选）。
   *
   * 为什么 Mock 也要有：真链路开深度思考时，正文前有 40~90 秒**完全没有正文**，
   * 只有 `thinking_delta` 在动（见 MathStoryboard/HANDOFF.md §8.12）。
   * Mock 不模拟这一段的话，前端这块 UI 在本地永远测不到 —— 而它恰恰是
   * 最需要"看着它在动"的那段时间。
   */
  thinking?: string;
};

/**
 * Mock 用的思考文本。
 *
 * ⚠️ 必须声明在 DERIVATIVE / PYTHAGOREAN **之前**：它们在对象字面量里直接引用
 * 这几个常量（`thinking: THINKING_DERIVATIVE`），而 const 有暂时性死区 ——
 * 写在后面的话，模块加载那一刻就 `ReferenceError: Cannot access before initialization`。
 *
 * 刻意写得像真的推理过程（短句、自言自语、会推翻自己），因为前端要验证的是
 * "一屏滚动的小字在动"这件事；写成一段整齐的说明文字反而看不出滚动/截断是否正常。
 */
const THINKING_DERIVATIVE =
  "用户问的是导数……先判断这是概念题还是题目。有「导数」两个字，但没给具体函数，" +
  "不过例题里常见的是 y=x²，而且前面有个类似的问题就是这么讲的，那就按抛物线来。" +
  "第一步得先给直觉：导数就是斜率。不能一上来就写公式，学生会不知道在算什么。" +
  "画图这一步要注意坐标轴得标出来，不然 y=x² 看起来和别的抛物线没区别。" +
  "动点那段是重点，切线要真的跟着走，右上角还得放个实时斜率 —— " +
  "等等，这样信息量是不是太多了？先保留，学生反馈说这块反而是最直观的。" +
  "最后收在 y′=2x 上，并且点明「斜率随 x 线性变化」，把这句和图像对上。" +
  "四段，大约 4.5 / 9 / 13 / 6 秒，节奏应该是递进的，不要第一段就讲太快。";

const THINKING_PYTHAGOREAN =
  "用户要勾股定理。这个题的标准证法有面积法和相似三角形，选面积法，更直观。" +
  "得先确认要不要用 3-4-5 这种特殊值 —— 用具体数字（9、16、25）比用 a² b² c² 抽象符号好懂，" +
  "但结论必须回到一般形式，否则学生会以为只对 3-4-5 成立。" +
  "三边各做一个正方形，这是整个证明的核心动作，必须给足时间让眼睛跟上。" +
  "最后一步把两个小正方形面积加起来，正好等于大的 —— 这一下要停久一点。";

const THINKING_CONCEPT =
  "这是个概念问题，不是一道要求解的题。判断：不该出动画。" +
  "硬造一段动画只会显得答非所问，而且用户等得更久。" +
  "那就直接用文字回答，并且明确告诉他「想要动画就把具体题目发来」—— " +
  "要把这条路指出来，不然用户会以为这个产品做不了动画。";

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
  thinking: THINKING_DERIVATIVE,
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
  thinking: THINKING_PYTHAGOREAN,
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
    thinking: THINKING_CONCEPT,
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

/**
 * 空会话时的推荐问题（点一下填进输入框）。
 *
 * 覆盖面要宽：空界面只有一句标题和一个输入框，用户第一眼得能看出
 * "这东西能回答哪类问题"。只放导数/极值的话，学积分的会以为它只能做求导。
 */
/*
 * 空态下那排"第一次该问什么"的示例。
 *
 * 挑选标准有两条，缺一不可：
 * 1. **学科上要有覆盖面** —— 摆一排全是数学题，会把"这是个数学工具"说死；
 *    产品实际上是任意学科的知识讲解。
 * 2. **必须"能被几何化表达"** —— 渲染出来的是确定性的几何动画，所以适配的是
 *    有明确图形对象、能拆成步骤的东西（函数图像、受力图、运动轨迹、区间收缩）；
 *    靠意境或分子机制推进的内容（古诗文的意象、光合作用）落不到可画的实体上，
 *    硬做只会是一堆无意义的箭头和方框，所以不放进示例。
 */
export const QUICK_PROMPTS = [
  "讲一下导数是什么",
  "用面积法证明勾股定理",
  "牛顿第二定律里的力、质量、加速度是什么关系",
  "抛体运动为什么可以拆成水平和竖直两个方向",
  "二分查找每一步是怎么砍掉一半的",
  "定积分和曲线下的面积到底是什么关系",
];
