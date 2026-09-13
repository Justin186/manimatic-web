/**
 * 前后端契约 —— 与 ../MathStoryboard/docs/Manimatic-前端架构设计.md §5 一一对应。
 *
 * ⚠️ 分镜 schema（elements / timeline 内部长什么样）的权威在 Python 侧
 *    （../MathStoryboard/storyboard/dsl.py）。这里**故意**用 unknown 不重复建模：
 *    重复建模 = 两份 schema 迟早漂移，而漂移是静默失败的温床。
 */

export type Role = "student" | "parent" | "teacher";

export type Profile = {
  role: Role;
  grade: string;
  subjects: string[];
};

export type StyleOverride = "concise" | "detailed" | "fun";

export type PlanStep = {
  id: number;
  title: string;
  durationSec: number;
  summary: string;
};

/** 分镜本体：只关心外层，内部交给 Python 侧 */
export type Scene = {
  id: number;
  duration?: number;
  elements?: unknown[];
  timeline?: unknown[];
  [k: string]: unknown;
};

export type Storyboard = {
  title: string;
  problem_type?: string;
  brief?: string;
  outline?: PlanStep[];
  intent?: "propose" | "none";
  scenes: Scene[];
};

/* ---------------- SSE 事件流（§5） ---------------- */

export type AssistantEvent =
  | { type: "text_delta"; text: string }
  /**
   * 模型的**思考过程**增量 —— 不是要显示给用户看的内容，而是"它还在动"的证据。
   *
   * 为什么需要它：开了深度思考的模型，正文要等思考走完才开始出字
   * （实测中转站要 49 秒，`/api/chat` 端到端首个可见字 93 秒）。这几十秒里
   * 唯一在动的东西就是思考流，不显示出去用户就只能干等，会以为程序死了。
   *
   * ⚠️ 后端**默认不发**（`MSB_LLM_SHOW_THINKING=1` 才发）：
   * 推理内容里可能有模型对用户的判断或本该藏起来的中间结论，
   * 要不要展示是产品决定。收不到这个事件时 UI 照样工作，只是没有思考预览。
   */
  | { type: "thinking_delta"; text: string }
  | { type: "plan"; plan: PlanStep[]; intent: "propose" | "none" }
  | { type: "tool_call"; name: "render_storyboard"; args: { storyboard?: Storyboard; segmentCount: number } }
  | { type: "tool_progress"; step: number; total: number; stage: "prewarm" | "rendering" | "concat" }
  | { type: "tool_result"; index: number; url: string; durationSec: number }
  | { type: "tool_done"; url: string; segmentCount: number }
  | { type: "error"; scope: "step" | "task"; index?: number; message: string; retryable: boolean }
  | { type: "done"; messageId: string };

/* ---------------- 渲染状态机 ---------------- */

export type SceneStatus = "queued" | "rendering" | "done" | "error";

export type SceneRender = {
  index: number;
  title: string;
  status: SceneStatus;
  url?: string;
  durationSec?: number;
  message?: string;
  retries?: number;
};

export type RenderState = {
  status: "idle" | "running" | "done" | "error";
  stage?: "prewarm" | "rendering" | "concat";
  step: number;
  total: number;
  scenes: SceneRender[];
  finalUrl?: string;
};

/* ---------------- 消息与会话 ---------------- */

export type PlanState = "none" | "pending" | "confirmed" | "discarded";

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  plan?: PlanStep[];
  planState?: PlanState;
  intent?: "propose" | "none";
  render?: RenderState;
  error?: string;
  version?: number;
  createdAt: number;
  /**
   * 模型的思考过程（拼起来的）。只在真实后端打开 `MSB_LLM_SHOW_THINKING` 时才有。
   *
   * 用 preview 字段而不是塞进 text：**它不是回答的一部分**，混进去会让
   * 「重试时清空 text」这类逻辑顺带把它也清掉，也会污染复制回答的结果。
   */
  thinking?: string;
  /** 是否还在思考（正文已经开始出字、或已结束时为 false） */
  thinkingLive?: boolean;
  /** 思考开始时刻，用来算"已思考 N 秒" */
  thinkingStartedAt?: number;
};

export type Thread = {
  id: string;
  title: string;
  subtitle?: string;
  updatedAt: number;
  /** 置顶：永远排在列表最前。排序由服务端定（本地改完也照同一规则重排） */
  pinned?: boolean;
  /** 已开启分享（侧栏只据此显示一个标记，链接本身不在列表里） */
  shared?: boolean;
};

export const ROLE_LABEL: Record<Role, string> = {
  student: "学生",
  parent: "家长",
  teacher: "教师",
};

/**
 * 讲解风格的可选项。
 *
 * ⚠️ 只此一份：设置页和工作台输入框都要用它，各写一份迟早漂移
 * （用户会在两个地方看到同一档叫不同的名字）。
 */
export const STYLE_OPTIONS: { value: StyleOverride; label: string; hint: string }[] = [
  { value: "concise", label: "精简", hint: "只讲关键步骤" },
  { value: "detailed", label: "详细", hint: "逐步推导（默认）" },
  { value: "fun", label: "活泼", hint: "口语化、多用类比" },
];
