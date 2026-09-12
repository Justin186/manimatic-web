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

/* ---------------- LLM 配置（设置页） ----------------
 *
 * 这几个是普通 JSON 接口，不是 SSE —— 只有生成/渲染那条链是流式的。
 *
 * ⚠️ 密钥**只进不出**：能提交，但后端从不回传（只回 `has_key`）。
 *    所以别在 UI 上试着"回显"密钥，它压根不在响应里。
 */

/** 一个模型档案。注意没有 api_key，只有 has_key。 */
export type LlmProfile = {
  name: string;
  active: boolean;
  provider: string;
  base_url: string;
  model: string;
  has_key: boolean;
  max_tokens: number | null;
  temperature: number | null;
  json_mode: boolean;
  headers: string[];
  note: string;
};

export type LlmProfilesResponse = {
  profiles: LlmProfile[];
  active: string;
  /** true = 配置还是旧版扁平形态（没有 profiles），这时设置页只展示、不改结构 */
  legacy: boolean;
  path: string;
  /** **真正生效**的值 —— 与"文件里写的"不一致时，以这个为准 */
  effective: {
    profile?: string;
    model?: string;
    provider?: string;
    max_tokens?: number;
    has_key?: boolean;
    error?: string;
  };
};

async function json<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${path} 返回 ${res.status}${detail ? `：${detail.slice(0, 200)}` : ""}`);
  }
  return (await res.json()) as T;
}

export function fetchLlmProfiles() {
  return json<LlmProfilesResponse>("/api/llm/profiles");
}

export type SwitchResult = {
  ok: boolean;
  error?: string;
  model?: string;
  active?: string;
  available?: string[];
};

export function setLlmActive(profile: string) {
  return json<SwitchResult>("/api/llm/active", { profile });
}

export type SaveLlmProfileRequest = {
  name: string;
  /** 非空 = 改这一档；空 = 新增 */
  profile?: string;
  provider?: string;
  base_url?: string;
  model?: string;
  /** 留空 = **保持原密钥不变**（前端拿不到旧密钥，留空绝不能被当成"清空"） */
  api_key?: string;
  max_tokens?: number;
  temperature?: number;
  json_mode?: boolean;
  headers?: Record<string, string>;
  note?: string;
};

export function saveLlmProfile(req: SaveLlmProfileRequest) {
  return json<{ ok: boolean; error?: string; name?: string }>("/api/llm/profile", req);
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
