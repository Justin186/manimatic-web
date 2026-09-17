import type { SceneRender } from "./types";

/** 时长还没拿到时的兜底（大纲没给、片段也还没到） */
const FALLBACK_DURATION = 6;

export type SlotState = "ready" | "pending" | "failed";

/**
 * 时间轴上的一个"格子"。
 *
 * ⚠️ `start` / `duration` 只由**分镜序号**与**该段时长**决定，与就绪状态无关。
 * 渲染进度只会把某一格从 pending 点亮成 ready，start 与 total 一格都不动，
 * 进度条因此永远不会漂移。
 *
 * 时长从哪来（契约见 docs/分镜实时交付-契约与前端改造.md §2）：
 *   - 后端的 `sections/index.json` / `tool_result.durationSec` 是**真实帧时长**
 *     （manim 按真的渲了多少帧算），这是权威值；
 *   - 大纲的 `durationSec` 只是设计值，和真值有出入，**确认阶段先拿它占位**，
 *     等该段 `tool_result` 到了就覆盖掉。
 *
 * 为什么"边到边覆盖"不会让进度条跳：后端是**单进程串行**渲染，片段严格
 * 1→N 到达。第 k 段到达时，它前面 k 段的真实时长都已经确定了，
 * 于是第 k 段的 `start` 一旦算出就不会再变 —— 已就绪的格子位置天然稳定。
 * （旧的多进程方案片段乱序到达，才有"后续分镜先到 → 覆盖时长 → 前面位置漂移"
 * 的问题，那套乱序缓冲编排器已经删掉了。）
 */
export type TimelineSlot = {
  index: number;
  title: string;
  start: number;
  duration: number;
  state: SlotState;
  url?: string;
};

export type Timeline = {
  slots: TimelineSlot[];
  total: number;
  readyCount: number;
};

function clamp(v: number, min: number, max: number) {
  if (Number.isNaN(v)) return min;
  return Math.min(Math.max(v, min), max);
}

export function slotState(scene: SceneRender): SlotState {
  if (scene.status === "done" && scene.url) return "ready";
  if (scene.status === "error") return "failed";
  return "pending";
}

/**
 * 按分镜先后铺出整条时间轴。
 *
 * 确认大纲时先用设计值占位（格子位置立刻定下来，用户能马上看到分镜结构），
 * 每段 `tool_result` 到达后用真实帧时长覆盖该格 —— 因为是串行交付，
 * 覆盖只影响该格自身与它**后面**的格子，前面已就绪的格子位置不变。
 */
export function buildTimeline(scenes: SceneRender[]): Timeline {
  const slots: TimelineSlot[] = [];
  let cursor = 0;
  let readyCount = 0;

  for (const scene of scenes) {
    const raw = scene.durationSec;
    const duration = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : FALLBACK_DURATION;
    const state = slotState(scene);
    if (state === "ready") readyCount += 1;
    slots.push({
      index: scene.index,
      title: scene.title,
      start: cursor,
      duration,
      state,
      url: scene.url,
    });
    cursor += duration;
  }

  return { slots, total: cursor, readyCount };
}

export function findSlot(timeline: Timeline, index: number): TimelineSlot | null {
  return timeline.slots.find((s) => s.index === index) ?? null;
}

/** 全局时间落在哪一格、以及格子内的局部时间 */
export function locate(
  timeline: Timeline,
  globalTime: number,
): { slot: TimelineSlot; localTime: number } | null {
  if (timeline.slots.length === 0) return null;
  const t = clamp(globalTime, 0, Math.max(timeline.total - 0.001, 0));

  let slot = timeline.slots[0];
  for (const s of timeline.slots) {
    if (s.start <= t) slot = s;
    else break;
  }
  return { slot, localTime: clamp(t - slot.start, 0, slot.duration) };
}

/**
 * 时间轴上的边界共享同一个时间值：第 k 格的终点与第 k+1 格的起点相等，
 * 而 `locate` 取的是**后一格**。所以"吸附到已就绪格子的终点"必须往回退一丁点，
 * 否则会被判成落进下一格（多半还没渲染），整个 seek 被当成非法目标丢掉。
 */
const EDGE_EPS = 0.001;

/**
 * 目标时间落在"渲染中/渲染失败"的格子里时，吸附到最近的**已就绪边界**。
 * 已经在某个已就绪格子内则原样返回。
 *
 * ⚠️ 返回值保证能被 `locate` 解回一个 `ready` 的格子 —— 这是调用方（`seekTo`）
 * 的前提。曾经终点是原样返回的，于是"第一遍渲染时只有第 1 段就绪、往右拖"
 * 会吸附到第 1 段的终点，`locate` 又把它解成第 2 段（还没渲染）：
 * seek 被静默丢弃，用户看到的就是**拖了完全没反应**。
 */
export function nearestReadyTime(timeline: Timeline, globalTime: number): number {
  const ready = timeline.slots.filter((s) => s.state === "ready");
  if (ready.length === 0) return 0;

  const t = clamp(globalTime, 0, timeline.total);
  for (const s of ready) {
    // 终点取开区间：闭区间会把"正好落在终点"判给自己，而它其实是下一格的开头
    if (t >= s.start && t < s.start + s.duration) return t;
  }

  let best = ready[0].start;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const s of ready) {
    const edges = [s.start, Math.max(s.start, s.start + s.duration - EDGE_EPS)];
    for (const edge of edges) {
      const d = Math.abs(edge - t);
      if (d < bestDist) {
        bestDist = d;
        best = edge;
      }
    }
  }
  return best;
}

/** 播完 fromIndex 之后该去哪儿：跳过渲染失败的分镜，返回下一个 ready 或 pending 的格子 */
export function nextPlayableSlot(timeline: Timeline, fromIndex: number): TimelineSlot | null {
  const from = timeline.slots.findIndex((s) => s.index === fromIndex);
  if (from < 0) return null;
  for (let i = from + 1; i < timeline.slots.length; i += 1) {
    const s = timeline.slots[i];
    if (s.state !== "failed") return s;
  }
  return null;
}

/** 从头开始的第一个"不失败"格子（重播用） */
export function firstPlayableSlot(timeline: Timeline): TimelineSlot | null {
  return timeline.slots.find((s) => s.state !== "failed") ?? null;
}
