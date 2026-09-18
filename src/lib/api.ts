import { readSSE, type SSEHandler } from "./sse";
import type { PlanStep, Profile, RenderState, Storyboard, StyleOverride } from "./types";

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

/**
 * 演示模式开关（`NEXT_PUBLIC_DEMO_MODE=true` 才开）。
 *
 * 开了才会往 store 里塞预置的示例会话（`SEED_THREADS`）。
 * **默认关**：后端没起来的时候不该显示一批假数据 —— 那会让人以为系统里真有历史
 * 记录（实测既能骗到演示现场的评委，也能骗到正在排查问题的自己）。
 *
 * ⚠️ 它和 USE_MOCK 是两件事：MOCK 决定"请求打到哪"，DEMO_MODE 决定"没数据时要不要
 *    拿预置内容顶上"。所以两者可以自由组合，也允许都不开（就是干净的空状态）。
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/**
 * 后端访问前缀。默认是空串（同源）。
 *
 * 现在这个值在 .env.local 里是 `/msb` —— 也就是"本站代理后端"的前缀（next.config.ts），
 * **不是**后端的地址。局域网下必须这样：别人的浏览器里 `localhost` 是他自己那台机器，
 * 直连 `http://localhost:8000` 一定失败。
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function url(path: string) {
  return USE_MOCK ? path : `${API_BASE}${path}`;
}

/**
 * 把后端回给我们的**绝对**媒体地址换成同源地址。
 *
 * 后端（`api/store.py::media_url`）拼的是 `{MSB_PUBLIC_BASE_URL}/media/...`，
 * 默认值 `http://localhost:8000` —— 在局域网访问时那个 localhost 指的是**访问者自己的机器**，
 * 于是"渲染成功、视频全 404"。这里把它换成 `/msb/media/...`，交给同源代理去取。
 *
 * 只动 pathname 是 `/media/` 的绝对地址：其它外链（将来真要接 CDN）原样放行，
 * 免得把不该改的地址也吞掉。`?v=<mtime>` 缓存戳必须保留 ——
 * 它是"重渲后浏览器别放旧视频"的唯一依据。
 */
export function mediaUrl(raw?: string | null): string {
  if (!raw) return "";
  const m = /^https?:\/\/[^/?#]+(\/media\/[^?#]*)(\?[^#]*)?/.exec(raw);
  return m ? `${API_BASE}${m[1]}${m[2] ?? ""}` : raw;
}

/* ---------------- 连接层失败的识别与措辞 ----------------
 *
 * 背景：生成大纲可能跑很久（开了深度思考的模型，光思考就几分钟）。
 * 这期间要是连接被掐断，前端拿到的是浏览器的原生异常 ——
 * Chrome/Edge `TypeError: Failed to fetch`、Firefox `NetworkError when
 * attempting to fetch resource.`、Safari `Load failed`。**原样显示出去就是一句
 * 英文 "network error"，用户只会理解成"超时了/你们崩了"**，而实际上：
 *
 *  1. /api/chat 的生成在独立线程里跑，**浏览器断开并不会让它停** ——
 *     结果照常落盘（assistant 记录里带 plan/intent），刷新页面就能看到大纲；
 *  2. 真正死于超时的是"这条 HTTP 连接"，不是"这次生成"。
 *
 * 所以这里做两件事：把这类异常识别出来，并给出一句**带出路**的话（刷新可见结果）。
 * ⚠️ 不要把这类失败和业务失败混为一谈：前者"任务可能还在跑"，后者"任务已经失败"。
 */

/** 终点事件：收到它才算这条流**正常走完**了。 */
const TERMINAL_EVENTS = new Set(["done"]);

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * 是不是"连接层面"的失败（而不是业务失败）。
 *
 * 主要判据是 `TypeError`：fetch 在请求没发出去/流被掐断时抛的就是它。
 * 文案兜一层是因为并非所有环境都守这个约定，而这类错误**误判成业务失败的代价更大**
 * （会让用户以为要重新生成一次，白烧一轮几分钟的 token）。
 */
function isConnectionFailure(err: unknown): boolean {
  // ⚠️ 不用宽泛的 `connection` 之类做关键词：那样会把后端真报上来的业务错误
  //（'Connection refused' 之类）也吞成"连接中断，任务可能还在跑" —— 那比不识别更坏。
  return err instanceof TypeError || /failed to fetch|network ?error|load failed/i.test(asMessage(err));
}

/**
 * 连接断了/流提前结束时给用户的那句话。
 *
 * 刻意**不带接口路径**：这是给用户看的，" /api/chat " 对他没有任何信息量，
 * 反而会让这句话看起来像一条技术报错。核心是后半句 —— 告诉用户**去哪儿拿结果**。
 * 措辞对聊天与渲染两条链都成立，所以不传"大纲"还是"视频"。
 */
function connectionLost(why: string): Error {
  return new Error(
    `${why}。任务可能仍在后台继续 —— 稍等一会儿刷新页面，看看结果是否已经出来。`,
  );
}

/**
 * 401 的统一处理：**跳登录页**，并把"现在在哪"带上（登录完回到原地）。
 *
 * 为什么放在这一层而不是每个调用点各写一遍：`/api/**` 现在整段需要登录，
 * 而前端有七八个入口会打它。漏一处的结果是"某个页面莫名其妙一直空着"
 * （请求 401 → 抛错 → 页面显示空态），而不是"跳去登录"—— 那种症状指不到鉴权上。
 *
 * ⚠️ 两个例外必须放过：
 *   1. `/api/auth/*` 自身的接口 —— 401 在那里是有意义的**返回值**（密码错、
 *      未登录时的 me），跳转会把人从登录页踢回登录页，转圈。
 *   2. 服务端渲染（`window` 不存在）—— 那是分享页那条路，它压根不需要登录。
 */
function onUnauthorized(path: string) {
  if (typeof window === "undefined") return;
  if (path.startsWith("/api/auth/")) return;
  const here = window.location.pathname + window.location.search;
  // 只带**站内路径**（单个 `/` 开头，`//evil.com` 这种协议相对 URL 也要挡）。
  // 登录页会再校验一次 —— 这是防开放重定向的第二道，不能只靠一边。
  const next =
    here.startsWith("/") && !here.startsWith("//")
      ? `?next=${encodeURIComponent(here)}`
      : "";
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 这里**故意**要整页跳转：401 意味着会话没了，而 store 里还留着上一个会话的数据，客户端路由不会清掉它
  window.location.href = `/login${next}`;
}

/**
 * 带状态码的错误。
 *
 * ⚠️ 为什么要专门做个类，而不是"往 message 里塞 401 然后 `includes("401")`"：
 *    那是靠**文本**认语义 —— 后端一句"第 401 步失败"就能让调用方误判成
 *    "没登录"然后跳登录页。状态码是结构化的信息，就该用结构化的方式带出来。
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** 是不是"没登录/登录失效"。调用方据此决定"跳登录"还是"报错"。 */
export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/**
 * 把后端的错误响应翻成**一句人话**。
 *
 * ============================================================================
 * 为什么值得单独抽出来（这是一次真实的糟糕体验）
 * ============================================================================
 * 后端所有错误响应都是 `{"ok": false, "error": "<能照着做的中文>", "code": "..."}`，
 * 但前端原来是直接 `throw new Error(path + " 返回 400：" + 响应体)` ——
 * 于是登录页上弹出的是这么一串：
 *
 *     /api/auth/register 返回 400: {"ok":false,"error":"这个密码太常见了，换一个",...}
 *
 * **后端点名要说的话被包在 JSON 里了**：用户看到的是接口路径和花括号，
 * 而"换一个密码"这五个字埋在中间。这跟本项目反复强调的
 * "报错要能据以行动"是直接冲突的。
 *
 * 三条规则，按优先级：
 *   1. 响应体里**有 `error`** → 原样用它（后端已经把人话说好了）
 *   2. 没有（比如网关回的 HTML、500 空体）→ 给一句带状态码的说明
 *   3. 解析不了 JSON → 也走第 2 条
 */
export async function apiErrorFrom(res: Response, path: string): Promise<ApiError> {
  const raw = await res.text().catch(() => "");
  let message = "";
  let code = "";
  try {
    const body = JSON.parse(raw) as { error?: unknown; code?: unknown; detail?: unknown };
    if (typeof body?.error === "string" && body.error.trim()) {
      message = body.error.trim();
      code = typeof body.code === "string" ? body.code : "";
    } else if (typeof body?.detail === "string" && body.detail.trim()) {
      // FastAPI 自己的校验错误长这样（`{"detail": "..."}`）
      message = body.detail.trim();
    }
  } catch {
    /* 不是 JSON（网关的 HTML 错误页之类）→ 走下面的兜底 */
  }
  if (!message) {
    message =
      res.status === 401
        ? "未登录或登录已失效"
        : `${path} 返回 ${res.status}${raw ? `：${raw.slice(0, 160)}` : ""}`;
  }
  return new ApiError(message, res.status, code);
}

async function post(path: string, body: unknown, onEvent: SSEHandler, signal?: AbortSignal) {
  const res = await fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
    // 同源代理下浏览器本来就会带 Cookie；显式写出来是为了"直连后端调试"
    // （那时候是跨源，默认的 same-origin 不会带 Cookie，症状是登录成功但下一个请求 401）
    credentials: "same-origin",
  });
  if (!res.ok) {
    const err = await apiErrorFrom(res, path);
    // 401 走"跳登录"；**先把错误建好再跳** —— 调用方还要 catch 到它，
    // 跳转是整页导航，但当前这轮 promise 仍需以异常收尾。
    if (err.status === 401) onUnauthorized(path);
    throw err;
  }

  // 记下这条流有没有走到终点事件。
  // 必须记：readSSE 在服务端正常关闭流时是**静默返回**的 —— 不区分的话，
  // "生成到一半连接断了"和"生成完了"在 UI 上长得一模一样（后者还会让人以为成功）。
  let finished = false;
  try {
    await readSSE(res, (name, data) => {
      if (TERMINAL_EVENTS.has(name)) finished = true;
      onEvent(name, data);
    });
  } catch (err) {
    if (isAbort(err)) throw err; // 用户点了"停止"：原样抛回，别包装成失败
    if (isConnectionFailure(err)) {
      throw connectionLost("与服务器的连接中断了（长时间没有数据时，网络或代理会掐掉空闲连接）");
    }
    throw err;
  }
  if (!finished) {
    throw connectionLost("连接提前结束了（没收到完成信号）");
  }
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

export async function json<T>(
  path: string,
  body?: unknown,
  method?: "GET" | "POST" | "PATCH" | "DELETE",
): Promise<T> {
  const res = await fetch(url(path), {
    // 不传 method 时按老规矩推：有 body 就是 POST，没有就是 GET。
    // （会话的改/删要 PATCH / DELETE，所以这里开了个后门。）
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    // 登录态靠 HttpOnly Cookie，必须让浏览器带上（同源代理下是自动的，
    // 但直连后端调试时不是 —— 见 post() 里的同一段说明）
    credentials: "same-origin",
  });
  if (!res.ok) {
    const err = await apiErrorFrom(res, path);
    if (err.status === 401) onUnauthorized(path);
    throw err;
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
  /**
   * 前端自己生成的消息 id（Workbench 里的 `uid("ma")` / `uid("mu")`）。
   *
   * 发给后端**只为让它落盘**：刷新后前端要靠这个 id 回头去找这条消息的分镜与渲染产物
   * （后端用 `task_name(thread_id, message_id)` 定位产物目录）。
   * 不传也能跑（后端会自己生成一个），但那条消息刷新之后就与自己的产物对不上号了。
   */
  message_id?: string;
  user_message_id?: string;
  /**
   * 随这一轮发出的题目图片（**base64 data URL**，见后端 `storyboard/vision.py`
   * 的 `normalize_many`）。
   *
   * 后端把它与普通问答做成了**同一个** `/api/chat`（可选字段），
   * 所以这里不需要按"有没有图"切换端点。
   *
   * 前端**不做压缩** —— 压缩全部交给后端 Pillow（确定性的；浏览器 canvas 编码
   * 在不同平台上对同一张图可能给出不同结果）。"压多少"只能有一处实现，
   * 否则前端压一次后端再压一次，出问题不知道看哪边。
   */
  images?: { data: string }[];
};

/**
 * 对话：text_delta → plan → done。
 *
 * ⚠️ 带图与不带图**打同一个端点** —— 后端把它们做成了同一个 `/api/chat`
 *    （多一个可选的 `images` 字段），因为"这一轮有没有图"不该改变接口契约：
 *    事件序列、重试策略、留档、取消全都一样，只有 messages 的构造不同。
 *    （早期图片输入是个独立插件、有独立端点 `/api/vi/chat`，已合并进 core，
 *    理由见 HANDOFF §8.68。）
 */
export function streamChat(req: ChatRequest, onEvent: SSEHandler, signal?: AbortSignal) {
  return post("/api/chat", req, onEvent, signal);
}

export type ConfirmRequest = {
  thread_id: string;
  message_id: string;
  plan: PlanStep[];
  storyboard?: Storyboard;
  // 这里曾有一个 `simulateFailure`（让第 3 个分镜失败，演示单分镜重试）。
  // 界面上那个开关已删除，前端不再发它 —— 但 mock 与后端接口仍然认这个字段，
  // 要演示那条交互时手工构造一次请求即可（见 HANDOFF §8.23）。
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

/* ---------------- 会话的改 / 删 / 分享 ----------------
 *
 * 这三样存的是**用户改出来的属性**（后端落在 `_tasks/sessions/<t>.json`），
 * 与渲染产物完全分开 —— 所以它们不会因为重新渲染而被冲掉。
 */

export type ThreadMutationResult = {
  ok: boolean;
  error?: string;
  title?: string;
  pinned?: boolean;
  /** 删掉的文件/目录个数（DELETE 用），用来给用户一句实在的回执 */
  removed?: number;
  /** 分享 token（POST 分享用） */
  slug?: string;
};

export function patchThread(threadId: string, patch: { title?: string; pinned?: boolean }) {
  return json<ThreadMutationResult>(
    `/api/threads/${encodeURIComponent(threadId)}`,
    patch,
    "PATCH",
  );
}

/** 删除会话。**连它的全部渲染产物一起删**（成片、分段、增量缓存），不可撤销。 */
export function deleteThread(threadId: string) {
  return json<ThreadMutationResult>(
    `/api/threads/${encodeURIComponent(threadId)}`,
    undefined,
    "DELETE",
  );
}

/**
 * 开 / 关分享。打开时后端返回一个 slug。
 *
 * ⚠️ 后端**只回 slug，不回完整链接** —— 它知道自己的地址（media 前缀挂在上面），
 *    但不知道前端跑在哪个端口。拼出一个打不开的链接，是那种很难被当成 bug
 *    看出来的错，所以链接由前端拿 `location.origin` 自己拼。
 */
export function setThreadShare(threadId: string, on: boolean) {
  return json<ThreadMutationResult>(
    `/api/threads/${encodeURIComponent(threadId)}/share`,
    { on },
  );
}

/* ---------------- 会话恢复（刷新后把工作台拼回来） ----------------
 *
 * 数据全部来自后端 `output/_tasks/`（见 ../MathStoryboard/api/routes/threads.py），
 * 前端**不做任何本地持久化** —— 这样换浏览器、换机器看到的都是同一批会话。
 *
 * ⚠️ 所有时间戳都是**毫秒**：后端在接口层已经转好了。前端别再乘 1000，
 *    漏一处就会在界面上显示成"1970 年前"。
 */

/** 会话摘要（GET /api/threads 的单项）。 */
export type ThreadSummary = {
  id: string;
  title: string;
  subtitle?: string;
  updatedAt: number;
  pinned?: boolean;
  shared?: boolean;
};

/** 会话里的一条消息，可直接并入 zustand 的 messages。 */
export type ThreadMessage = {
  /** 前端当初生成、并被后端落盘的那个 id —— confirm 靠它定位产物 */
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  /** 这一轮的视频标题（模型给的「整个讲解的标题」）；没有就由前端兜底 */
  videoTitle?: string;
  intent?: "propose" | "none";
  plan?: PlanStep[];
  planState?: "none" | "pending" | "confirmed";
  /** 由后端扫盘重建：每段的状态/时长/地址，以及整条成片 */
  render?: RenderState;
};

export type ThreadsResponse = {
  threads: ThreadSummary[];
  /** 会话保留天数；超过它没动过的会被后端清掉（0 = 不清理）。界面要明示 */
  ttl_days: number;
};

export function fetchThreads() {
  return json<ThreadsResponse>("/api/threads");
}

export function fetchThreadDetail(threadId: string) {
  return json<{ thread_id: string; messages: ThreadMessage[] }>(
    `/api/threads/${encodeURIComponent(threadId)}`,
  ).then((r) => ({
    ...r,
    // 刷新后恢复出来的视频地址同样要过一遍 mediaUrl：
    // 这条路径不经过 SSE，漏掉它就会出现"新渲的能放、刷新一下视频就没了"。
    messages: r.messages.map((m) =>
      m.render
        ? {
            ...m,
            render: {
              ...m.render,
              finalUrl: m.render.finalUrl ? mediaUrl(m.render.finalUrl) : m.render.finalUrl,
              scenes: m.render.scenes.map((s) => (s.url ? { ...s, url: mediaUrl(s.url) } : s)),
            },
          }
        : m,
    ),
  }));
}
