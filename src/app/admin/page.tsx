"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, Sparkles } from "lucide-react";

import { AdminOverview } from "@/components/auth/AdminOverview";
import { AdminUsers } from "@/components/auth/AdminUsers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SEGMENTED_GROUP, segmentItemClass } from "@/components/ui/segmented";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserMenuButton } from "@/components/auth/UserMenuButton";
import { fetchMe, type AuthUser } from "@/lib/auth";

/**
 * 管理后台（独立页面，不是设置页里的一块）。
 *
 * ============================================================================
 * 为什么不复用 RequireAuth
 * ============================================================================
 * `RequireAuth` 只管"登录没登录"，而这里要的是"**是不是管理员**"。
 * 复用它的话，普通用户能打开这个页面、看见一个空壳（组件自己不渲染内容），
 * 那既让人困惑（"怎么是白页"），也把"这里有个管理入口"暴露给了不该看到的人。
 *
 * 所以这里自己判三层：未登录 → 跳登录；已登录但非管理员 → 明确说"你没有权限"
 * （**不是**白页，也不是 404 —— 用户需要知道自己是被拒绝了，而不是页面坏了）；
 * 管理员 → 渲染。
 *
 * ⚠️ 这只是**界面**。真正的权限在后端每条 `/api/auth/users*` 里显式复核
 *    （见 api/auth/admin.py 文件头）—— 前端这层挡不住任何直接调接口的人。
 */
export default function AdminPage() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  /** 当前选项卡。默认"概览" —— 进来先看现状，而不是先看到一堆人和按钮 */
  const [tab, setTab] = useState<"overview" | "users">("overview");

  useEffect(() => {
    let alive = true;
    void fetchMe()
      .then((u) => {
        if (!alive) return;
        setMe(u);
        setReady(true);
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 未登录必须整页跳（客户端路由会先渲染出这个空壳页再跳，看到一瞬白页）
        if (!u) window.location.href = "/login?next=%2Fadmin";
      })
      .catch(() => {
        // 后端不可用：**不跳登录页**（那会让人以为是自己没登录）。
        // 打开 ready 让页面显示一个"拉不到身份"的状态。
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="t-glass sticky top-0 z-20 border-b border-border">
        <div className="page-shell flex h-14 items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="t-grad grid h-7 w-7 place-items-center rounded-control text-accent-fg">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="font-display text-base font-semibold text-fg">智绘课堂</span>
          </Link>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <span className="text-sm text-fg-muted">管理后台</span>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle size="sm" />
            <UserMenuButton size="sm" />
          </div>
        </div>
      </header>

      <main className="page-shell flex-1 py-8">
        {!ready ? (
          <p className="flex items-center gap-2 text-sm text-fg-subtle">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在确认身份…
          </p>
        ) : !me ? (
          <Card>
            <CardHeader>
              <CardTitle>拉不到你的身份</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-fg-muted">
                后端服务可能没起来。这<strong className="font-medium text-fg">不是</strong>
                你没登录 —— 登录状态存在浏览器的 Cookie 里，而这次请求根本没拿到响应。
              </p>
              <Button asChild>
                <Link href="/">回到首页</Link>
              </Button>
            </CardContent>
          </Card>
        ) : !me.isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-warn" />
                你没有管理权限
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-fg-muted">
                这个页面只有管理员能进。如果你认为应该有权访问，请联系部署这个服务的人。
              </p>
              <Button asChild variant="outline">
                <Link href="/app">回到创作台</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {/* 选项卡而不是堆成一页：后台会长大，一页堆下去就变成"找不到东西" */}
            <div className={SEGMENTED_GROUP}>
              <button
                type="button"
                className={segmentItemClass(tab === "overview")}
                onClick={() => setTab("overview")}
              >
                概览
              </button>
              <button
                type="button"
                className={segmentItemClass(tab === "users")}
                onClick={() => setTab("users")}
              >
                账号
              </button>
            </div>

            {tab === "overview" ? (
              <div className="space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-fg">概览</h1>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                    当前现状 + **需要你处理的事**。不是实时监控，是拉一次的快照（右上角可刷新）。
                  </p>
                </div>
                <AdminOverview />
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-fg">
                    账号管理
                  </h1>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                    建号 / 停用 / 重置密码 / 提降权 / 删号。删号不会删除该账号的会话与视频。
                  </p>
                </div>
                <AdminUsers />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
