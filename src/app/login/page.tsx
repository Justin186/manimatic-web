"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/primitives";
import { SEGMENTED_GROUP, segmentItemClass } from "@/components/ui/segmented";
import { login, register, fetchAuthConfig, safeNext, type AuthConfig } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * 登录页（真实表单）。
 *
 * 之前这里是"选测试账号"的静态页：点一下就进 `/app`，不发任何请求。
 * 现在接的是后端 `api/auth/router.py`，两种形态：
 *
 *   · **登录**：邮箱 + 密码
 *   · **注册**：邮箱 + 密码 + 邀请码（后端 `MSB_AUTH_INVITE` 没配时注册整体关闭，
 *     这时切换按钮直接不出现 —— 让用户填完再吃一个 403 是最差的做法）
 *
 * ⚠️ 三个不能省的点：
 *   1. **`?next=` 必须过 `safeNext()`**（见 lib/auth.ts）—— 那是开放重定向的入口；
 *   2. `useSearchParams` 在 App Router 里要求组件在 `<Suspense>` 之下（否则
 *      整页会被降级成客户端渲染，`next build` 直接报错）；
 *   3. 登录成功的**唯一判据是后端回了 user**，不是"表单没报错" ——
 *      错误一律原样显示后端那句话（它已经写成能读懂的中文了）。
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [mode, setMode] = useState<"login" | "register">("login");
  const [cfg, setCfg] = useState<AuthConfig | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 先问后端"注册开不开"：不开就干脆不显示注册那一档。
  // 拉不到（后端没起）不阻断登录 —— 让人先能试，错了再报错。
  useEffect(() => {
    let alive = true;
    void fetchAuthConfig()
      .then((c) => alive && setCfg(c))
      .catch(() => alive && setCfg(null));
    return () => {
      alive = false;
    };
  }, []);

  const canRegister = Boolean(cfg?.registerOpen);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        await register({ email, password, invite });
      } else {
        await login(email, password);
      }
      // 用 replace：登录页不该留在历史里（按返回键回到"已登录的登录页"很怪）
      router.replace(next);
    } catch (err) {
      // 原样显示后端的话：它每条都是可操作的（"邀请码不正确"、"这个邮箱已经注册过了"）
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="page-shell grid min-h-dvh place-items-center bg-bg py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="t-grad grid h-8 w-8 place-items-center rounded-control text-accent-fg">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-semibold text-fg">智绘课堂</span>
        </Link>

        <Card className="p-6">
          <h1 className="font-heading text-xl font-semibold text-fg">
            {mode === "login" ? "登录" : "注册"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            {mode === "login"
              ? "用邮箱和密码登录。登录状态保持在你自己的浏览器里（服务端存的是令牌指纹）。"
              : "注册需要邀请码 —— 这个部署是私有环境，账号由管理员发放。"}
          </p>

          {canRegister && (
            <div className={cn(SEGMENTED_GROUP, "mt-5")}>
              <button
                type="button"
                className={segmentItemClass(mode === "login")}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                登录
              </button>
              <button
                type="button"
                className={segmentItemClass(mode === "register")}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                注册
              </button>
            </div>
          )}

          <form onSubmit={submit} className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs text-fg-muted">邮箱</span>
              <Input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs text-fg-muted">
                密码
                {mode === "register" && cfg ? `（至少 ${cfg.minPassword} 位）` : ""}
              </span>
              <Input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>

            {mode === "register" && (
              <label className="block">
                <span className="mb-1.5 block text-xs text-fg-muted">邀请码</span>
                <Input
                  required
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  placeholder="管理员给你的那个码"
                />
              </label>
            )}

            {error && (
              <p className="rounded-inner bg-err-soft px-3 py-2 text-xs leading-relaxed text-err">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {mode === "login" ? "登录" : "注册并登录"}
            </Button>
          </form>

          {!canRegister && cfg && !cfg.registerOpen && (
            <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
              当前部署的注册入口是关的。需要账号请联系管理员；如果你是部署者，
              用启动日志里那个超级管理员邮箱登录。
            </p>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-fg-subtle">
          <Link href="/" className="underline-offset-2 hover:text-fg hover:underline">
            返回首页
          </Link>
        </p>
      </div>
    </div>
  );
}
