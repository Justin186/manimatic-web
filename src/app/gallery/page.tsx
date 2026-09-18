"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import { UserMenuButton } from "@/components/auth/UserMenuButton";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { fetchGallery, type GalleryItem, type GalleryScope } from "@/lib/api";
import { fetchMe } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * 作品画廊。
 *
 * ============================================================================
 * 为什么它是客户端组件，而不是像分享页那样走服务端取数
 * ============================================================================
 * 分享页 (`/share/[slug]`) 是一个**确定的对象**：给一个 slug 就一定能拿到那段视频，
 * 拿不到就是"打不开了"这个终态，所以服务端渲染最合适（还能免费拿到主题跟随）。
 *
 * 画廊不是：它是"一屏会变的东西"，而且至少有三处状态必须由浏览器决定：
 *   1. 谁在看（`mine` 标记、"我的"这个 Tab 存不存在）；
 *   2. 发布/撤下之后列表要即时更新（服务端组件做不到局部刷新）；
 *   3. 展开播放、悬停预览全在客户端。
 * 硬做成服务端组件的话，这三件事都得靠"整页重载"来兜，体验反而倒退。
 *
 * ⚠️ 未登录**也能看**（这是刻意的）：画廊是公开的作品墙，把未登录的人挡在
 *    登录页外面，等于要求他们先注册才能知道这个产品能做出什么。
 *    所以这里**不套 RequireAuth** —— 只有「我的」这个 Tab 需要登录，
 *    它由 `user` 是否存在来决定显不显示。
 */

/** Tab 值域。用字面量联合而不是 string，切换时拼错会被 TS 拦住 */
type Tab = GalleryScope;

export default function GalleryPage() {
  const toast = useToast();
  /** 已加载的全部作品（「我的」在本地过滤，见下面的注释） */
  const [all, setAll] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** 读取失败但仍有内容的条数（后端 skipped），有的话要说出来 */
  const [skipped, setSkipped] = useState(0);
  const [tab, setTab] = useState<Tab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** 登录身份。null = 未登录（或还没问完） */
  const [loggedIn, setLoggedIn] = useState(false);

  /*
   * ---------------- 拉取作品：请求与落状态**拆成两个函数** ----------------
   *
   * ⚠️ 拆开是必需的，不是风格问题。仓库启用了 `react-hooks/set-state-in-effect`：
   *    在 effect 体里调用一个"自己会 setState"的函数（哪怕 setState 在 await 之后）
   *    会被判为级联渲染。而把 setState 放进 `.then(落库函数)` 的回调里则是它认可的
   *    形态（"外部系统通知我们"）。
   *    所以：`request` 只管发请求、**一行 state 都不碰**；落状态由 `apply` / `fail`
   *    在 `.then` 里做。effect 与"重试"两条路径都走这套，口径天然一致。
   */

  /** 只发请求。**不碰任何 state**（见上） */
  const request = useCallback(() => {
    // ⚠️ 一次拉「全部」，切换 Tab 在本地过滤。
    //    为什么不做成"每个 Tab 各请求一次"：`mine` 是 `all` 的**子集**，
    //    再打一次接口只是把同一批数据换个口径返回，而代价是每次切 Tab
    //    都要等一个来回（切换本来应该是瞬时的）。
    //    数据可以到 200 条，本地过滤的开销可以忽略。
    return fetchGallery("all");
  }, []);

  const apply = useCallback((r: { items: GalleryItem[]; skipped: number }) => {
    setAll(r.items);
    setSkipped(r.skipped);
    setError("");
    setLoading(false);
  }, []);

  const fail = useCallback((err: unknown) => {
    // 这里**不把 401 当"没登录"**：画廊是公开页，401 只可能来自
    // 代理/网关配置错误。当成"连不上"并说清，比默默显示空墙好。
    console.error("[gallery] 拉取作品失败", err);
    setError(err instanceof Error ? err.message : String(err));
    setAll([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    // `alive` 守卫是必需的：`next dev` 默认开 StrictMode，effect 会跑两遍；
    // 第一遍被 cleanup 后若还落状态，会覆盖第二遍的结果。
    void request().then(
      (r) => {
        if (alive) apply(r);
      },
      (e: unknown) => {
        if (alive) fail(e);
      },
    );
    return () => {
      alive = false;
    };
  }, [request, apply, fail]);

  /** 重新加载。按钮回调里置位是安全的（不在 effect 体里） */
  function retry() {
    setLoading(true);
    void request().then(apply, fail);
  }

  useEffect(() => {
    let alive = true;
    void fetchMe()
      .then((u) => {
        if (alive) setLoggedIn(Boolean(u));
      })
      .catch(() => {
        // 后端没起来：按未登录显示。**不要**跳登录页 —— 那会让人以为是自己没登录
        if (alive) setLoggedIn(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const items = useMemo(
    () => (tab === "mine" ? all.filter((i) => i.mine) : all),
    [all, tab],
  );

  /** 展开/收回。**同一时刻只展开一张**：多张同时播放既吵又费流量 */
  const toggle = useCallback((threadId: string) => {
    setExpandedId((cur) => (cur === threadId ? null : threadId));
  }, []);

  /**
   * 卡片里撤下发布之后的本地同步。
   *
   * 与侧栏/分享弹窗的约定一致：**先改本地**（用户按下就该立刻看到结果），
   * 失败时由发起方（ShareDialog）弹提示，这里只做"已撤下 = 从列表消失"。
   * 不重新拉一次列表：那会让整面墙闪一下骨架屏，为了一个条目付出全页代价。
   */
  const onPublishedChange = useCallback((threadId: string, on: boolean) => {
    if (on) return;
    setAll((list) => list.filter((i) => i.threadId !== threadId));
    setExpandedId((cur) => (cur === threadId ? null : cur));
    toast("已从画廊撤下");
  }, [toast]);

  const tabs: { value: Tab; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "mine", label: "我的" },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* ------------------------------ 顶栏 ------------------------------ */}
      {/* 与落地页同一套：毛玻璃吸顶，长滚动页里它要能"浮"在内容上而不是切一刀 */}
      <header className="t-glass sticky top-0 z-20 border-b border-border">
        <div className="page-shell flex h-14 items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="t-grad grid h-7 w-7 place-items-center rounded-control text-accent-fg">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="font-display text-base font-semibold text-fg">智绘课堂</span>
          </Link>

          {/* 当前在哪：窄屏隐藏，本页自己也有一级标题，重复一遍只是噪音 */}
          <span className="hidden h-5 w-px bg-border sm:block" />
          <span className="hidden text-sm text-fg-muted sm:inline">作品画廊</span>

          <nav className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/pricing">套餐</Link>
            </Button>
            <ThemeToggle size="sm" />
            <UserMenuButton size="sm" />
            <Button size="sm" variant="grad" asChild>
              <Link href="/app">
                <span className="hidden sm:inline">进入创作台</span>
                <span className="sm:hidden">创作</span>
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ------------------------------ 页头 ------------------------------ */}
        <section className="relative overflow-hidden border-b border-border">
          {/* 一层极淡的品牌光晕。暗色档会自动换成提亮版（不要内联写死颜色） */}
          <div aria-hidden className="t-glow pointer-events-none absolute inset-0" />

          <div className="page-shell relative py-10">
            <h1 className="font-display text-3xl font-bold tracking-tight text-fg md:text-4xl">
              作品画廊
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-fg-muted">
              这里是可以直接看的讲解动画 —— 由几何计算生成，图形精确、不会走样。
              点开任意一张就地播放，不用跳页。
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <SegmentedControl
                items={tabs}
                value={tab}
                onChange={setTab}
                label="作品范围"
              />
              <span className="tnum text-xs text-fg-subtle" suppressHydrationWarning>
                {loading ? "正在加载…" : `共 ${items.length} 个作品`}
              </span>
              {/*
                有作品读不出来时**要说**：静默少几条，是那种"用户永远发现不了、
                但一定会在某天觉得数字不对"的问题。
              */}
              {skipped > 0 ? (
                <span className={cn("tnum text-xs text-warn")}>
                  另有 {skipped} 条读取失败
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {/* ------------------------------ 网格 ------------------------------ */}
        <section className="page-shell py-8">
          <GalleryGrid
            items={items}
            loading={loading}
            error={error}
            scope={tab}
            expandedId={expandedId}
            loggedIn={loggedIn}
            onToggle={toggle}
            onRetry={retry}
            onPublishedChange={onPublishedChange}
          />

          {/* 没有作品可看时也给出"做一段"的出口（空态里已经有按钮，这里只在有内容时补一句） */}
          {!loading && !error && items.length > 0 ? (
            <div className="mt-10 flex flex-col items-center gap-3 border-t border-border pt-10 text-center">
              <p className="text-sm text-fg-muted">也想让别人看到你的讲解？</p>
              <Button variant="grad" asChild>
                <Link href="/app">
                  做一段讲解动画
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : null}
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="page-shell flex flex-wrap items-center gap-3 py-6 text-xs text-fg-subtle">
          <span>智绘课堂</span>
          <span className="text-border">·</span>
          <span>动画由几何计算生成，图形精确、不会走样</span>
          <span className="ml-auto">2026 实训项目</span>
        </div>
      </footer>
    </div>
  );
}
