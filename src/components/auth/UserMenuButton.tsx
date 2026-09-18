"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Images, LayoutDashboard, LogOut, User as UserIcon } from "lucide-react";

import { Avatar } from "@/components/ui/fragments";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/primitives";
import { cachedUser, displayName, fetchMe, logout, rememberUser, type AuthUser } from "@/lib/auth";
import { USE_MOCK } from "@/lib/api";

/**
 * 通用版"登录态"控件：未登录显示「登录」，已登录显示头像 + 菜单。
 *
 * 为什么抽成一个组件：顶栏有**两处**（工作台 `TopBar` 与落地页），
 * 而"登录/未登录该显示什么"这件事一旦各写一套，必然出现
 * "在 A 页面看到的态和 B 页面不一致"——用户这次的反馈正是这个：
 * **明明登录了，落地页还写着「登录」**。
 *
 * 两个刻意的做法：
 *   · 未登录时**不做任何跳转判断**，就是一个 `/login` 链接（带 `?next=` 由
 *     登录页自己在跳回来时处理）；已登录时直接进创作台。
 *   · 头像首字用显示名，拿不到身份时退回一个中性字面 —— 不编假名字出来。
 *
 * ⚠️ 身份走 `lib/auth.ts` 的**模块级缓存**：顶栏跟着工作台一起重新挂载
 *    （切会话就会），不缓存的话每次都要重问一遍 `/api/auth/me`，
 *    而 `ready` 之前这里渲染的是「登录」——于是切一次会话，右上角就从
 *    「登录」跳回头像，这也是"整个页面闪一下"的一部分。
 */
export function UserMenuButton({ size = "md" }: { size?: "sm" | "md" }) {
  const [user, setUser] = useState<AuthUser | null>(() => cachedUser() ?? null);
  const [ready, setReady] = useState(() => cachedUser() !== undefined);
  const pathname = usePathname();

  // 当前在哪 → 决定菜单里**不显示**哪一项（见下面的注释）
  const inWorkbench = pathname === "/app" || pathname.startsWith("/app/");
  const onSettings = pathname === "/settings";
  const onAdmin = pathname === "/admin";
  const onGallery = pathname === "/gallery";

  useEffect(() => {
    if (cachedUser() !== undefined) return;    // 已经问过（见上面的 ⚠️）
    let alive = true;
    void fetchMe()
      .then((u) => {
        if (!alive) return;
        rememberUser(u);
        setUser(u);
        setReady(true);
      })
      .catch(() => {
        // 后端没起来：按"未登录"显示。**不要**在这里跳登录页 ——
        // 那会让人以为是自己没登录，而真正的问题是服务不可用。
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const btn = size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-3.5 text-sm";

  if (!ready || !user) {
    return (
      <Link
        href="/login"
        className={`inline-flex items-center justify-center rounded-control border border-border bg-surface font-medium text-fg t-tx hover:bg-surface-2 ${btn}`}
      >
        登录
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="shrink-0 rounded-pill" aria-label="账号">
          <Avatar
            fallback={displayName(user).slice(0, 1).toUpperCase()}
            className={size === "sm" ? "h-8 w-8" : "h-9 w-9"}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="block">
            <span className="block text-fg">{displayName(user)}</span>
            <span className="block truncate text-xs text-fg-subtle">{user.email}</span>
            {user.isRoot && (
              <span className="mt-1 block">
                <Badge tone="warn">超级管理员</Badge>
              </span>
            )}
            {!user.isRoot && user.isAdmin && (
              <span className="mt-1 block">
                <Badge tone="accent">管理员</Badge>
              </span>
            )}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/*
          ⚠️ "进入创作台"是**条件项**：已经在创作台里时它是个空操作，
             点了什么都不发生 —— 用户上次就是被这一条问住的
             （"明明都在创作台里了怎么有进入创作台"）。
             判断用路径前缀而不是精确匹配：`/app/t/<id>` 也算在创作台里。

          ⚠️ 每一项都要有图标。菜单里混着"有图标的"和"没图标的"，
             文字起始位置会对不齐，看着像没做完。
        */}
        {!inWorkbench && (
          <DropdownMenuItem asChild>
            <Link href="/app">
              <Home className="h-3.5 w-3.5" />
              进入创作台
            </Link>
          </DropdownMenuItem>
        )}
        {/*
          作品画廊。**未登录也能进**（它是公开页），所以这一项不放在下面的登录态分支里 ——
          但它会出现在登录后（这个菜单只在已登录时渲染）。
          当前已在画廊时隐藏，理由与上面"进入创作台"相同：点了没反应的空操作项，
          只会让人以为点错了。
        */}
        {!onGallery && (
          <DropdownMenuItem asChild>
            <Link href="/gallery">
              <Images className="h-3.5 w-3.5" />
              作品画廊
            </Link>
          </DropdownMenuItem>
        )}
        {!onSettings && (
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <UserIcon className="h-3.5 w-3.5" />
              画像与偏好
            </Link>
          </DropdownMenuItem>
        )}
        {user.isAdmin && !onAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboard className="h-3.5 w-3.5" />
              管理后台
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void (async () => {
              try {
                await logout();
              } catch {
                /* 登出失败也走：用户的本意是"离开"，而服务端那条会话可能已过期 */
              }
              // ⚠️ 整页跳转而不是 router.push：store 里还留着上一个账号的会话，
              //    客户端路由不会清它，那些数据会闪一下再被覆盖（看起来像串号）。
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 同上：必须整页跳转才能清掉 store 里的旧账号数据
              window.location.href = "/login";
            })();
          }}
          disabled={USE_MOCK}
        >
          <LogOut className="h-3.5 w-3.5" />
          {USE_MOCK ? "退出（演示模式）" : "退出登录"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
