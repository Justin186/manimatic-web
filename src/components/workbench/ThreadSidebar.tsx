"use client";

import { useRef, useState } from "react";
import {
  Check,
  Images,
  Link2,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/popover";
import { Input, Separator } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/section";
import { USE_MOCK } from "@/lib/api";
import type { Thread } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  threads: Thread[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** 会话在后端的保留天数（来自 /api/threads）。0/未给 = 后端不清理 */
  ttlDays?: number;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onShare: (id: string) => void;
  /** 删除。**确认对话框由调用方负责** —— 侧栏只负责发起 */
  onDelete: (ids: string[]) => void;
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

export function ThreadSidebar({
  threads,
  activeId,
  onSelect,
  onNew,
  ttlDays,
  onRename,
  onTogglePin,
  onShare,
  onDelete,
}: Props) {
  /** 正在改名的会话 id（null = 没在改名）。改名走内联输入，不弹窗 */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  /** 多选模式与已勾选项 */
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  /**
   * 改名的"已提交"标记。
   * Enter 提交之后输入框还会失焦，onBlur 又会提交一次 —— 用 state 判断挡不住
   * （闭包里读到的还是旧值），所以用 ref 做一次性的闸门。
   */
  const submitGate = useRef<string | null>(null);

  function startRename(t: Thread) {
    submitGate.current = t.id;
    setRenamingId(t.id);
    setDraft(t.title);
  }

  function commitRename() {
    const id = submitGate.current;
    submitGate.current = null;
    setRenamingId(null);
    const title = draft.trim();
    if (id && title) onRename(id, title);
  }

  function cancelRename() {
    submitGate.current = null;
    setRenamingId(null);
  }

  function togglePick(id: string) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setPicked(new Set());
  }

  const allPicked = threads.length > 0 && picked.size === threads.length;

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="p-3">
        {selectMode ? (
          // 多选时把"新建"换成批量工具条：同一块位置放两套按钮容易点错，
          // 而且这会儿用户的心思在"挑几条删掉"，不在新建。
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPicked(allPicked ? new Set() : new Set(threads.map((t) => t.id)))}
            >
              {allPicked ? "取消全选" : "全选"}
            </Button>
            <span className="tnum text-xs text-fg-muted">已选 {picked.size}</span>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-err hover:bg-err-soft hover:text-err"
              onClick={() => onDelete([...picked])}
              disabled={!picked.size}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </Button>
            <IconButton label="退出多选" size="sm" onClick={exitSelect}>
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        ) : (
          <Button variant="outline" className="w-full justify-start" onClick={onNew}>
            <Plus className="h-4 w-4" />
            新建讲解
          </Button>
        )}
      </div>
      <Separator />

      <nav className="scrollbar-thin flex-1 overflow-y-auto p-2">
        <p className="px-2 pb-1 text-xs font-medium text-fg-subtle">最近</p>
        {threads.length === 0 ? (
          /*
           * 空态必须说清"本来就没有"还是"没连上" —— 这两件事在界面上长得一模一样，
           * 但排查方向完全不同。以前这里躺着的是预置会话，把两者都盖住了。
           */
          /* ⚠️ 空态文案里不要出现 Mock / 后端 / 接口 这类词：用户看到的是
             "这里怎么是空的"，不是"哪个进程没起来"。 */
          <EmptyState
            className="px-2 py-6"
            icon={<MessageSquareText className="h-5 w-5" />}
            title={USE_MOCK ? "演示模式没有历史记录" : "还没有历史会话"}
            desc={
              USE_MOCK
                ? "当前是演示模式，不读取历史会话。"
                : "新建一条讲解并发出第一条消息后，它会出现在这里；如果一直空着，可能是服务暂时不可用。"
            }
          />
        ) : (
          <ul className="space-y-0.5">
            {threads.map((t) => (
              <li key={t.id} className="group">
                {renamingId === t.id ? (
                  <div className="flex items-center gap-1 px-1 py-0.5">
                    <Input
                      autoFocus
                      value={draft}
                      aria-label="会话标题"
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") cancelRename();
                      }}
                      // 点到别处就当作提交（而不是静默丢弃用户打的字）
                      onBlur={commitRename}
                      className="h-8"
                    />
                    <IconButton
                      label="确认改名"
                      size="sm"
                      className="shrink-0"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={commitRename}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "t-tx flex items-center rounded-control",
                      t.id === activeId && !selectMode ? "bg-accent-soft" : "hover:bg-surface-2",
                    )}
                  >
                    {selectMode ? (
                      <button
                        onClick={() => togglePick(t.id)}
                        className="ml-1.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-border-strong bg-surface"
                        aria-label={picked.has(t.id) ? "取消选择" : "选择"}
                        aria-pressed={picked.has(t.id)}
                      >
                        {picked.has(t.id) ? <Check className="h-3 w-3 text-accent" /> : null}
                      </button>
                    ) : (
                      <MessageSquareText
                        className={cn(
                          "ml-2 h-4 w-4 shrink-0",
                          t.id === activeId ? "text-accent" : "text-fg-subtle",
                        )}
                      />
                    )}

                    <button
                      onClick={() => (selectMode ? togglePick(t.id) : onSelect(t.id))}
                      className="min-w-0 flex-1 py-2 pl-2 pr-1 text-left"
                    >
                      <span className="flex items-center gap-1">
                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            t.id === activeId && !selectMode ? "text-accent" : "text-fg",
                          )}
                        >
                          {t.title}
                        </span>
                        {t.pinned ? <Pin className="h-3 w-3 shrink-0 text-accent" /> : null}
                        {/*
                          已发布到画廊。与分享标记（链接图标）并列但**外形必须能区分**：
                          两个都表示"公开了"，但一个是"给知道链接的人"，
                          一个是"摆在作品墙上"。用同一个图标就等于告诉用户它们是同一件事。
                        */}
                        {t.gallery ? (
                          <Images className="h-3 w-3 shrink-0 text-fg-subtle" />
                        ) : null}
                        {t.shared ? <Link2 className="h-3 w-3 shrink-0 text-fg-subtle" /> : null}
                      </span>
                      {/* 相对时间依赖 `Date.now()`，服务端与 hydration 可能算出不同文字 */}
                      <span
                        className="block truncate text-xs text-fg-subtle"
                        suppressHydrationWarning
                      >
                        {t.subtitle ?? relative(t.updatedAt)}
                      </span>
                    </button>

                    {!selectMode ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            // 小屏常显（触摸设备没有 hover 可依赖），大屏才收起来 ——
                            // 否则手机上这个按钮永远点不到。
                            className={cn(
                              "t-tx mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-control",
                              "text-fg-subtle hover:bg-surface-3 hover:text-fg",
                              "opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
                              "md:opacity-0 md:group-hover:opacity-100",
                            )}
                            aria-label="更多操作"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => startRename(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                            重命名
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onTogglePin(t.id, !t.pinned)}>
                            {t.pinned ? (
                              <PinOff className="h-3.5 w-3.5" />
                            ) : (
                              <Pin className="h-3.5 w-3.5" />
                            )}
                            {t.pinned ? "取消置顶" : "置顶"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onShare(t.id)}>
                            <Link2 className="h-3.5 w-3.5" />
                            {t.shared ? "分享设置" : "分享"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setSelectMode(true);
                              setPicked(new Set([t.id]));
                            }}
                          >
                            <Square className="h-3.5 w-3.5" />
                            多选
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => onDelete([t.id])}
                            className="text-err data-[highlighted]:bg-err-soft"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* 保留期限要摆在明面上：会话会被按时清理，不说的话"数据凭空消失"只会被当成 bug */}
      {ttlDays ? (
        <p className="border-t border-border px-3 py-2 text-xs text-fg-subtle">
          会话最多保留 {ttlDays} 天
        </p>
      ) : null}
    </div>
  );
}
