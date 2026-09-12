import { readSSE, type SSEHandler } from "./sse";
import type { PlanStep, Profile, Storyboard, StyleOverride } from "./types";

/**
 * 后端切换开关。
 *
 * MOCK=true（默认）：打本项目自带的 Next.js Route Handler（src/app/api/*），
 *   事件形态与真实 Python 服务完全一致，只是渲染用 public/demo 下的真实成片顶替。
 * MOCK=false：打到 NEXT_PUBLIC_API_BASE_URL 指向的 FastAPI 服务
 *   （见 ../MathStoryboard/docs/前端接入-后端改造清单.md）。
 *
 * 也就是说：**接真后端不用改任何组件**，只改这一个环境变量。
 */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function url(path: string) {
  return USE_MOCK ? path : `${API_BASE}${path}`;
}

async function post(path: string, body: unknown, onEvent: SSEHandler, signal?: AbortSignal) {
  const res = await fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${path} 返回 ${res.status}${detail ? `：${detail.slice(0, 200)}` : ""}`);
  }
  await readSSE(res, onEvent);
}

export type ChatRequest = {
  thread_id: string;
  message: string;
  profile: Profile;
  overrides?: { style?: StyleOverride; targetDurationSec?: number };
};

/** 对话：text_delta → plan → done */
export function streamChat(req: ChatRequest, onEvent: SSEHandler, signal?: AbortSignal) {
  return post("/api/chat", req, onEvent, signal);
}

export type ConfirmRequest = {
  thread_id: string;
  message_id: string;
  plan: PlanStep[];
  storyboard?: Storyboard;
  /** 仅 Mock 模式需要：让第 3 个分镜渲染失败，用来演示单分镜重试。真后端忽略此字段。 */
  simulateFailure?: boolean;
};

/** 确认生成：tool_call → tool_progress* → tool_result* → tool_done */
export function confirmRender(req: ConfirmRequest, onEvent: SSEHandler, signal?: AbortSignal) {
  return post("/api/render/confirm", req, onEvent, signal);
}

export type RetryRequest = {
  thread_id: string;
  message_id: string;
  scene_index: number;
};

/** 单分镜重试（对应 Q12-B：绝不让整条任务失败） */
export function retryScene(req: RetryRequest, onEvent: SSEHandler, signal?: AbortSignal) {
  return post("/api/render/retry", req, onEvent, signal);
}

export type ReplaceSceneRequest = {
  thread_id: string;
  message_id: string;
  scene_index: number;
  instruction: string;
  /** 重做后的目标时长（秒）；不给则沿用原分镜 */
  durationSec?: number;
};

/** 整分镜替换（对应 Q16：不用文本 patch，让模型重新输出一个完整分镜） */
export function replaceScene(req: ReplaceSceneRequest, onEvent: SSEHandler, signal?: AbortSignal) {
  return post("/api/storyboard/replace-scene", req, onEvent, signal);
}
