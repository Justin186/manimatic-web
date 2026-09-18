"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * 媒体查询也走"**模块级缓存** + useSyncExternalStore"，与下面的 localStorage 同一套写法。
 *
 * ⚠️ 原来写的是 `useState(false) + useEffect`，首帧必然是 false，要等 effect 才有真值。
 *    而**切换会话会让工作台整页重新挂载**（见 components/auth/RequireAuth.tsx 的说明），
 *    于是每切一次会话，侧栏都会先按"窄屏"渲染一帧（收起、w-0），再带着宽度动画滑开 ——
 *    用户看到的是"整个页面闪一下"。缓存之后，重新挂载的**第一帧**就是上次解析好的值，
 *    这一跳没了。
 *
 * ⚠️ 首次加载仍然以 false 开局（`getServerSnapshot`）—— 与服务端渲染一致，
 *    不会 hydration 不匹配；随后由订阅回调补上真值（只多一帧，只在首屏）。
 */
const mediaCache = new Map<string, boolean>();

function readMedia(query: string): boolean {
  const cached = mediaCache.get(query);
  if (cached !== undefined) return cached;
  let v = false;
  try {
    v = window.matchMedia(query).matches;
  } catch {
    /* 极老浏览器：按不匹配处理，与以前一样 */
  }
  mediaCache.set(query, v);
  return v;
}

/** 服务端（以及客户端首帧）的快照：没有 window，只能给"不匹配"。 */
const mediaServerSnapshot = () => false;

/** SSR 安全的媒体查询。 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      let mql: MediaQueryList;
      try {
        mql = window.matchMedia(query);
      } catch {
        return () => {};
      }
      const onChange = () => {
        const next = mql.matches;
        if (mediaCache.get(query) === next) return;   // 值没变就不惊动 React
        mediaCache.set(query, next);
        cb();
      };
      mql.addEventListener("change", onChange);
      // ⚠️ 挂载时对一次真实值：缓存可能是"上一次挂载时"的，而窗口大小
      //    在没人订阅的那段时间里可能变过。它发生在提交之后，且只在真的
      //    不同时才触发重渲染，所以不会把首帧的稳定性又破坏掉。
      onChange();
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(subscribe, () => readMedia(query), mediaServerSnapshot);
}

/*
 * localStorage 读写放在模块级，配合 useSyncExternalStore 订阅。
 *
 * 为什么不用「useState + useEffect 读 localStorage」那种常见写法：
 *   1. effect 里同步 setState 会触发级联渲染（eslint 的 react-hooks 规则直接报错）
 *   2. 服务端渲染时 window 不存在，只能给默认值，首帧必然与客户端不一致
 * useSyncExternalStore 的 getServerSnapshot 正好解决第 2 点：
 *   首帧用默认值（与服务端一致），hydration 完成后再切到真实值，不会被判为不匹配。
 */
const cache = new Map<string, unknown>();
const subscribers = new Map<string, Set<() => void>>();

function read<T>(key: string, initial: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  let value = initial;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) value = JSON.parse(raw) as T;
  } catch {
    /* 隐私模式下 localStorage 可能不可用，用默认值即可 */
  }
  cache.set(key, value);
  return value;
}

export function useLocalStorage<T>(key: string, initial: T) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const set = subscribers.get(key) ?? new Set<() => void>();
      set.add(cb);
      subscribers.set(key, set);
      return () => {
        set.delete(cb);
      };
    },
    [key],
  );

  const value = useSyncExternalStore(
    subscribe,
    () => read(key, initial),
    () => initial,
  );

  const set = useCallback(
    (next: T) => {
      cache.set(key, next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* 同上 */
      }
      subscribers.get(key)?.forEach((cb) => cb());
    },
    [key],
  );

  return [value, set] as const;
}
