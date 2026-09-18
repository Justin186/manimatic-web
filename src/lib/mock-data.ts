import type { PlanStep, Thread } from "./types";

/**
 * Mock 数据。
 *
 * 视频用的是**你们自己渲出来的真画面**（从 ../MathStoryboard/output 拷到 public/demo）：
 *   fewshot_derivative_s0~s4  = 提示词里 few-shot **示例 1** 的 5 个分镜片段
 *                               （`examples/fewshot_derivative.json` 的真渲染产物）
 *   derivative_s0~s3          = free_derivative 的 4 个分镜片段（旧演示，**已无引用**）
 *   pythagorean_s0~s3         = free_pythagorean 成片按分镜时长切分
 * 所以演示里"分镜级进度 + 逐段播放"看到的是真实效果，不是占位图。
 *
 * ⚠️ fewshot 那组是 **720p30**（`-q m`）渲的，重渲命令：
 *      python generate.py examples/fewshot_derivative.json --name fewshot_derivative_demo --split -q m
 *    产物在 `output/videos/<name>_scene/720p30/StoryboardScene.mp4`（成片）与
 *    `output/_parts/<name>/segments/<name>_s<i>/720p30/StoryboardScene.mp4`（分镜）。
 *    ⚠️ `--split` 的分段落在 `_parts/`，**不在** `sections/`（那是 `--split` 之外那条
 *    路径才写的），别去 `sections/` 找。
 *    ⚠️ 换质量档之后 `segmentDurations` **必须重新量**（见下），别沿用旧值。
 *
 * ⚠️ `segmentDurations` 是 ffprobe 量出来的**真实帧时长**，语义等价于后端
 * `sections/index.json` 的 `duration`（manim 按真实帧数算的）。
 * 它和 `plan[].durationSec`（大纲设计值）**故意不同** —— 前端必须用前者铺时间轴，
 * 否则分镜定位会漂（见 docs/分镜实时交付-契约与前端改造.md §2）。
 *
 * ⚠️ 它还和**渲染质量档**绑定（每段时长要按帧取整，15fps 与 30fps 的边界不一样）。
 *    实测同一份分镜：480p15 合计 55.467s，720p30 合计 56.932s。
 *    所以「换档重渲」和「改分镜」一样，都必须重新量一遍这组数。
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

/**
 * 演示成片：**就是给模型看的那份 few-shot 示例 1**（`examples/fewshot_derivative.json`）。
 *
 * ⚠️ 这里刻意与提示词里的示例 1 保持**同一份内容**（同一个题、同样的 5 镜、同样的标题、
 *    同样的 outline）：首页那句"真实生成的一段"于是成了字面意义上的真话 ——
 *    观众看到的这一段，正是模型每次写分镜之前都要先看一遍的那个示范。
 *    换成另一段视频（哪怕更漂亮）会立刻破掉这层关系，而那是这个页面唯一有分量的东西。
 *
 * ⚠️ 所以改这里之前先想清楚：要么同时改提示词里的示例 1（`storyboard/llm.py` 的
 *    `_EXAMPLE` 读的那个文件），要么就别改。
 *
 * ⚠️ `plan` 用的是**示例文件里的 outline**（模型自己拟的分镜大纲），
 *    `segmentDurations` 是 ffprobe 量的**真实帧时长**。
 *    两者故意不同（大纲 7.4/13.4/13.8/11.8/7.2，实际 7.4/13.8/14.2/12.2/7.867）——
 *    前端时间轴只能吃后者，用大纲值会让分镜定位整体漂掉（见 timeline.ts 的说明）。
 *    这也是"设计值 vs 真实值"最容易看出来的一个例子，所以别顺手把它们"统一"了。
 */
export const DERIVATIVE: Canned = {
  key: "derivative",
  match: /导数|切线|斜率|求导|derivative/i,
  title: "导数就是切线斜率",
  brief:
    "导数说的是「函数在这一点变化得有多快」。以 y = x² 为例：先在曲线上取两点，算出这段的平均变化率 Δy/Δx = 2 + Δx；再让 Δx 趋近 0，这个比值逼近 2 —— 它正是曲线在 (1, 1) 处切线的斜率。然后用导数的定义把 y′ = 2x 一步步算出来（正统做法），最后带出常用求导公式：它们都是同一个定义算出来的。",
  plan: [
    { id: 1, title: "要求的是什么", durationSec: 7.4, summary: "摆出题目：求 y = x² 在 x = 1 处的切线斜率；并点出「一个点给不出上升和前进的比」" },
    { id: 2, title: "先算平均变化率", durationSec: 13.4, summary: "再取一点、连成割线，标出 Δx 与 Δy 两条边，把 Δx 代进公式看比值随它变小" },
    { id: 3, title: "每一点都有自己的斜率", durationSec: 13.8, summary: "Δx 趋于 0，割线趋近切线；旁边同步放出 y′ = 2x 的图像，两个点一起走 —— 扫完收口到「求切线斜率就是求导」" },
    { id: 4, title: "正统做法：用定义算一遍", durationSec: 11.8, summary: "用导数的定义把 y = x² 的导数一步步算出来（定义 → 代入 → 展开 → 约分取极限，每步旁边有注释），得到 y′ = 2x，x = 1 处即 2 —— 和图上看到的一致" },
    { id: 5, title: "常用求导公式", durationSec: 7.2, summary: "把这一题的结果推广成一张公式表（幂函数、三角函数、指数、对数），并点明它们都是同一个定义算出来的 —— 公式只是省掉每次重推" },
  ],
  segments: [
    "/demo/fewshot_derivative_s0.mp4",
    "/demo/fewshot_derivative_s1.mp4",
    "/demo/fewshot_derivative_s2.mp4",
    "/demo/fewshot_derivative_s3.mp4",
    "/demo/fewshot_derivative_s4.mp4",
  ],
  // ffprobe 实测各分镜真实帧时长（合计 56.932s，与成片时长一致）
  //
  // ⚠️ 这组数与**渲染质量档绑定**，换档必须重新量：同一份分镜在 480p15 下是
  //    7.400/13.800/14.200/12.200/7.867（合计 55.467），在 720p30 下变成下面这组 ——
  //    因为每段时长要按**帧**取整，15fps 与 30fps 的边界位置不同。
  //    差别看着只有半秒上下，但分镜定位是逐段累加的，累积到第 5 镜就会偏出 1.5 秒。
  segmentDurations: [8.066, 14.066, 14.467, 12.467, 7.866],
  final: "/demo/fewshot_derivative_full.mp4",
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
    // 与 Mock 画廊列表（src/app/api/gallery/route.ts）里的演示作品对应：
    // `demo` 这条是"我的"，所以侧栏这里也要带上已发布标记，
    // 否则同一条会话在侧栏说没发布、在画廊说已发布 —— 两处对不上就成了新的困惑。
    gallery: true,
  },
  {
    id: "t_pyth",
    title: "勾股定理：面积证法",
    subtitle: "4 个分镜 · 草稿",
    updatedAt: Date.now() - 1000 * 60 * 60 * 3,
    // 这条在 Mock 里是"别人（林老师）发布的"，所以本账号侧栏里不该出现发布标记
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
