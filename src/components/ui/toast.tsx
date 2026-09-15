"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 轻提示。
 *
 * 替换掉 `Workbench` 里手写的那块 `note` 状态：原来它只能显示一条、位置写死在组件里、
 * 弹提示的逻辑散落在十来个 `setNote(...)` 调用点上。收成 Provider 之后：
 *   · 任意子组件 `const toast = useToast(); toast("链接已复制")`
 *   · 多条可以叠，点一下各自消失
 *   · 生命周期由 Provider 统一管（组件卸载时清掉定时器，不留泄漏）
 *
 * 用**反色面**（`bg-inverse`）而不是纯黑：暗色模式下反色面会反过来变亮，
 * 否则一条深色提示贴在深色页面上等于没有。
 */

type Toast = { id: number; text: string };

const ToastContext = React.createContext<(text: string) => void>(() => {});

/** 提示存活时长：够读完一句话，又不至于挡着下一步操作 */
const TTL = 3200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = React.useState<Toast[]>([]);
  const timers = React.useRef<Map<number, number>>(new Map());
  const seq = React.useRef(0);

  const drop = React.useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setList((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback(
    (text: string) => {
      if (!text) return;
      const id = ++seq.current;
      setList((prev) => [...prev, { id, text }]);
      timers.current.set(id, window.setTimeout(() => drop(id), TTL));
    },
    [drop],
  );

  // 卸载时清掉所有未触发的定时器
  React.useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => window.clearTimeout(timer));
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        // pointer-events-none 让容器不吃点击；按钮自己再打开 pointer-events
        className="pointer-events-none fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2"
        role="status"
        aria-live="polite"
      >
        {list.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => drop(t.id)}
            className={cn(
              "anim-pop pointer-events-auto max-w-[min(28rem,calc(100vw-3rem))]",
              "rounded-pill bg-inverse px-3.5 py-2 text-xs text-inverse-fg",
              "shadow-raised",
            )}
          >
            {t.text}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** 拿到"弹一条提示"的函数。没有 Provider 时是空操作，不会抛错。 */
export function useToast() {
  return React.useContext(ToastContext);
}
