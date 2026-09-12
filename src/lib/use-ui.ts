"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/** SSR 安全的媒体查询。首帧一律 false，挂载后才有真值，避免 hydration 不一致。 */
export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatch(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return match;
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
