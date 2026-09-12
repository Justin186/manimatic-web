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
};

export type Thread = {
  id: string;
  title: string;
  subtitle?: string;
  updatedAt: number;
};

export const ROLE_LABEL: Record<Role, string> = {
  student: "学生",
  parent: "家长",
  teacher: "教师",
};
