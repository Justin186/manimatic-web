"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cachedUser, fetchMe, rememberUser, type AuthUser } from "@/lib/auth";

/**
 * 页面级登录守卫。
 *
 * ============================================================================
 * 为什么是客户端组件，而不是 `middleware.ts`
 * ============================================================================
 * middleware 跑在 **Next 服务端**，而会话 Cookie 是**后端**种下的。
 * 即便前端是"同源代理"（`/msb` 转发），那个 Cookie 也只在**浏览器**里，
 * Next 服务端读 `request.cookies.get("msb_session")` 永远是空的 ——
 * 写出来的守卫会把**所有人**挡在门外，而且看起来像"登录功能坏了"。
 *
 * 所以守卫只能在浏览器里问一次后端（`/api/auth/me`）。
 *
 * ============================================================================
 * 四个不能省的细节
 * ============================================================================
 * 1. **加载期间显示占位，不能先渲染真页面**。否则未登录用户会看到内容闪一下
 *    再被踢走；页面里那些 useEffect 还会拿着 401 的结果渲染出错态。
 * 2. **`alive` 标记**。`next dev` 默认开 StrictMode，挂载 effect 会跑两遍；
 *    第一遍被 cleanup 后若还 setState，会覆盖第二遍的结果。
 * 3. **跳转只做一次**。用 `router.replace` 而不是 push：登录页按返回键不该
 *    回到这个"注定被弹走"的页面。
 * 4. **问过就记住**（`lib/auth.ts` 的 `cachedUser`）。否则每切一次会话都会重新挂载
 *    → 重新问 → 先渲染一帧整页空占位 → 用户看到"整个页面闪一下"。
 *    身份这东西在一次页面会话里不会变，缓存下来重挂载就能**第一帧就有值**。
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // 有缓存时**第一帧就当作已确认**（不会再闪出那个空占位）
  const [user, setUser] = useState<AuthUser | null>(() => cachedUser() ?? null);
  const [checked, setChecked] = useState(() => cachedUser() !== undefined);

  useEffect(() => {
    // 已经问过就不用再问：会话中途失效由 401 兜住 —— `lib/api.ts` 的
    // `onUnauthorized` 见到 401 就整页跳登录页，不会出现"过期了还进得去"。
    if (cachedUser() !== undefined) return;
    let alive = true;
    void fetchMe()
      .then((u) => {
        if (!alive) return;
        rememberUser(u);
        setUser(u);
        setChecked(true);
        if (!u) {
          const here = window.location.pathname + window.location.search;
          router.replace(`/login?next=${encodeURIComponent(here)}`);
        }
      })
      .catch(() => {
        // 后端没起来 / 网络断了：**不倒向"未登录"**。
        // 倒向未登录会把人扔到登录页，而真正的问题是后端不可用 ——
        // 那会让人以为是密码不对。这里只把 checked 打开，让页面自己显示空态。
        // ⚠️ 失败**不写缓存**：下次挂载还要再问一次（后端起来了就能进）。
        if (alive) setChecked(true);
      });
    return () => {
      alive = false;
    };
  }, [router]);

  if (!checked) {
    // 占位：与页面同底色，只是"先别渲染内容"。
    // 刻意不放转圈 —— 本地网络下这一步只有几十毫秒，转圈反而像卡了一下。
    return <div className="grid min-h-dvh place-items-center bg-bg text-sm text-fg-subtle" />;
  }
  if (!user) return null;
  return <>{children}</>;
}
