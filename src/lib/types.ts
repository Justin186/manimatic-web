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
  /**
   * 大纲 + **视频标题**（模型给的「整个讲解的标题」，见后端 events.plan）。
   *
   * ⚠️ 它不是会话标题：会话标题是另一条独立请求生成的（`thread_title` 事件），
   * 两者不共用 —— 视频标题要能说清讲了什么，会话标题只是侧栏里的短标签。
   */
  | { type: "plan"; plan: PlanStep[]; intent: "propose" | "none"; title?: string }
  /**
   * 会话标题（侧栏里那个名字），由后端一次独立的短调用生成，1~2 秒就到。
   *
   * 为什么它比 plan 早到：那条请求与主生成**并行**，不必等整份分镜生成完。
   * 收不到就维持"用户输入前 20 字"—— 后端失败时是静默降级，不会报错。
   */
  | { type: "thread_title"; title: string }
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

/**
 * 一张随消息发出的图片（前端只存"这一轮要传的"形态）。
 *
 * ⚠️ `dataUrl` 是完整的 `data:image/...;base64,...`，**只活在内存里**：
 *    后端明确不落盘、不进会话历史（见 MathStoryboard/api/routes/chat.py 里
 *    assistant 落盘那段），所以刷新页面后图片就没了 —— 这是刻意的诚实降级，
 *    比"假装能回显"好。别把它写进 localStorage 或往会话接口里塞。
 */
export type ImageAttachment = {
  /** 本地唯一 id（React key + 删除用），与后端无关 */
  id: string;
  /** data URL；发给后端时直接放进 `images[].data` */
  dataUrl: string;
  /** 原始文件名（选择文件时有；粘贴截图时给个默认名），只用于显示 */
  name: string;
  /** 原始字节数（前端压缩前的，只用于显示"3.2MB"这类提示） */
  bytes: number;
};

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
  /**
   * 这条消息对应的**视频标题**（模型给的「整个讲解的标题」）。
   *
   * 叫 videoTitle 而不是 title：会话标题是另一回事（存在 threads 里），
   * 两个都叫 title 迟早会串。
   */
  videoTitle?: string;
  /** 是否还在思考（正文已经开始出字、或已结束时为 false） */
  thinkingLive?: boolean;
  /** 思考开始时刻，用来算"已思考 N 秒" */
  thinkingStartedAt?: number;
  /**
   * 这条用户消息带上的图片（**只在本轮内存里**，刷新后不再有，见 ImageAttachment）。
   *
   * 放在 Message 上而不是别处：气泡渲染图片需要它，而气泡的唯一数据源就是 Message。
   */
  images?: ImageAttachment[];
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
