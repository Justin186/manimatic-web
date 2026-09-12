"use client";

import { Plus, MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/primitives";
import type { Thread } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  threads: Thread[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
};

function relative(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  return `${Math.floor(hr / 24)} 天前`;
}

export function ThreadSidebar({ threads, activeId, onSelect, onNew }: Props) {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="p-3">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={onNew}>
          <Plus className="h-4 w-4" />
          新建讲解
        </Button>
      </div>
      <Separator />

      <nav className="scrollbar-thin flex-1 overflow-y-auto p-2">
        <p className="px-2 pb-1 text-xs font-medium text-ink-soft">最近</p>
        <ul className="space-y-0.5">
          {threads.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onSelect(t.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors",
                  t.id === activeId ? "bg-navy-900/5 text-navy-900" : "text-ink hover:bg-canvas",
                )}
              >
                <MessageSquareText
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    t.id === activeId ? "text-brick-600" : "text-ink-soft",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t.title}</span>
                  {/* 相对时间依赖 `Date.now()`，服务端与 hydration 可能算出不同文字 */}
                  <span className="block truncate text-xs text-ink-soft" suppressHydrationWarning>
                    {t.subtitle ?? relative(t.updatedAt)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
