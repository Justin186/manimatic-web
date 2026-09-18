import { json, USE_MOCK } from "./api";

/**
 * 鉴权客户端（登录 / 注册 / 登出 / 当前身份）。
 *
 * 后端是 `api/auth/router.py`：五个端点，登录态靠 **HttpOnly Cookie** ——
 * JS 里**拿不到也存不下**令牌，所以这里没有任何 token 的存取逻辑。
 * 页面上唯一的"登录态"判断是 `fetchMe()`。
 */

export type AuthUser = {
  id: number;
  email: string;
  /** 显示名；没填就是空串（UI 要自己兜底，别渲染出空头像） */
  name: string;
  /** 画像里的身份：student / parent / teacher …（由用户设置页维护） */
  role: string;
  isAdmin: boolean;
  isRoot: boolean;
};

export type AuthConfig = {
  ok: boolean;
  enabled: boolean;
  /** 注册是否需要邀请码（false = 注册关闭） */
  registerOpen: boolean;
  minPassword: number;
  sessionDays: number;
};

/**
 * Mock 模式下的"演示账号"。
 *
 * ⚠️ 为什么要有它：`NEXT_PUBLIC_USE_MOCK=true` 时请求打的是前端自带的假路由，
 *    那里**没有** /api/auth/*，不兜底的话本地开发会卡在登录页上出不来。
 *    它只影响"界面上显示谁"，没有任何真实权限含义。
 */
const MOCK_USER: AuthUser = {
  id: 0,
  email: "demo@local",
  name: "演示账号",
  role: "teacher",
  isAdmin: true,
  isRoot: false,
};

const MOCK_CONFIG: AuthConfig = {
  ok: true,
  enabled: true,
  registerOpen: false,
  minPassword: 8,
  sessionDays: 14,
};

export async function fetchAuthConfig(): Promise<AuthConfig> {
  if (USE_MOCK) return MOCK_CONFIG;
  return json<AuthConfig>("/api/auth/config");
}

export async function fetchMe(): Promise<AuthUser | null> {
  if (USE_MOCK) return MOCK_USER;
  const r = await json<{ ok: boolean; user: AuthUser | null }>("/api/auth/me");
  return r.user ?? null;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  if (USE_MOCK) return MOCK_USER;
  const r = await json<{ ok: boolean; user: AuthUser }>("/api/auth/login", {
    email,
    password,
  });
  return r.user;
}

export async function register(req: {
  email: string;
  password: string;
  name?: string;
  invite?: string;
}): Promise<AuthUser> {
  if (USE_MOCK) return MOCK_USER;
  const r = await json<{ ok: boolean; user: AuthUser }>("/api/auth/register", req);
  return r.user;
}

export async function logout(): Promise<void> {
  if (USE_MOCK) return; // 演示账号没有真会话，登出只做界面跳转
  await json<{ ok: boolean }>("/api/auth/logout");
}

/* ---------------- 账号管理（仅管理员） ----------------
 *
 * 这四条打的是 `/api/auth/users*`。它们在**白名单前缀**之下，所以闸门不拦 ——
 * 权限是后端在每条接口里**显式复核**的（见 api/auth/admin.py 文件头）。
 * 前端这里不做权限判断（判断了也不算数，只是别让人白点）。
 */

export type AdminUser = AuthUser & {
  /** active / disabled */
  status: string;
  createdAt: number;
};

export async function fetchUsers(): Promise<AdminUser[]> {
  if (USE_MOCK) return [MOCK_USER as AdminUser];
  const r = await json<{ ok: boolean; users: AdminUser[] }>("/api/auth/users");
  return r.users;
}

function mockUnsupported(): never {
  throw new Error("演示模式下没有真实的账号系统（把 NEXT_PUBLIC_USE_MOCK 关掉再试）");
}

export async function createUser(req: {
  email: string;
  password: string;
  name?: string;
  role: "user" | "admin";
}): Promise<AdminUser> {
  if (USE_MOCK) mockUnsupported();
  const r = await json<{ ok: boolean; user: AdminUser }>("/api/auth/users", req);
  return r.user;
}

/**
 * 改一个账号。
 *
 * `revoked` 只在**重置密码**时非零：那意味着对方正在用的会话被吊销了、
 * 会被立刻踢下线。界面必须说出来 —— 否则管理员会以为"我改了没生效"。
 */
export async function patchUser(
  id: number,
  patch: { name?: string; role?: "user" | "admin"; status?: "active" | "disabled"; password?: string },
): Promise<{ user: AdminUser; revoked: number }> {
  if (USE_MOCK) mockUnsupported();
  return json<{ ok: boolean; user: AdminUser; revoked: number }>(
    `/api/auth/users/${id}`,
    patch,
    "PATCH",
  );
}

/** 后台首屏要的一屏数据（见后端 admin.overview）。 */
export type AdminOverview = {
  ok: boolean;
  users: (AdminUser & { threads: number; bytes: number })[];
  stats: { users: number; admins: number; threads: number; bytes: number };
  /** 公共区（无归属）的老数据 */
  legacy: { threads: number; bytes: number };
  /** 属于**已删除账号**的数据：磁盘还在，但没人能访问 */
  orphan: { threads: number; bytes: number };
  server: {
    version: string;
    latex: boolean;
    latex_reason: string;
    ffmpeg: boolean;
    llm: { model: string; profile: string; has_key: boolean };
    quality: string;
    ttlDays: number;
    maxRenders: number;
    jobs: Record<string, unknown>;
    outputDir: string;
  };
  config: {
    registerOpen: boolean;
    cookieSecure: boolean;
    sessionDays: number;
    adoptLegacy: boolean;
    db: string;
  };
  /** 需要现在处理的事（没人盯着就会出事的那种） */
  warnings: string[];
  checklist: string[];
};

export async function fetchOverview(): Promise<AdminOverview> {
  if (USE_MOCK) mockUnsupported();
  return json<AdminOverview>("/api/auth/overview");
}

/** 清理过期渲染产物（**不动**会话数据，见后端 store.cleanup_stale）。 */
export async function runCleanup(days?: number): Promise<{ removed?: string[]; cleaned?: number }> {
  if (USE_MOCK) mockUnsupported();
  return json("/api/admin/cleanup" + (days ? `?days=${days}` : ""), {});
}

/** 删号。**不动**他名下的会话与视频（后端在 note 里写明了）。 */
export async function deleteUser(id: number): Promise<{ note: string }> {
  if (USE_MOCK) mockUnsupported();
  return json<{ ok: boolean; note: string }>(`/api/auth/users/${id}`, undefined, "DELETE");
}

/** 显示名兜底：没填名字就退回邮箱 @ 前面那段。 */
export function displayName(u: AuthUser | null | undefined): string {
  if (!u) return "";
  return u.name || u.email.split("@")[0];
}

/**
 * 校验 `?next=` 的落点。
 *
 * ⚠️ 这是**开放重定向**的入口：`?next=` 完全由 URL 控制，登录页正是用户刚输完
 *    密码、最放松警惕的一刻 —— 跳到钓鱼站就能骗到第二次输入。
 *
 * 只接受以**单个 `/`** 开头的站内路径：
 *   · `//evil.com` 是协议相对 URL，浏览器会当成跨站，必须挡掉；
 *   · 反斜杠 `/\evil.com` 在部分浏览器里等价于 `//`，一并挡掉。
 * 不合格一律回落到 `/app`（不是回落到空串 —— 那会让登录后停在白页）。
 */
export function safeNext(raw: string | null | undefined): string {
  const s = String(raw ?? "");
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\")) return "/app";
  return s;
}
