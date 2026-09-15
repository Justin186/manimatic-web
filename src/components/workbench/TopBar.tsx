"use client";

import Link from "next/link";
import { PanelLeft, PanelRight, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/fragments";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type Props = {
  title: string;
  navOpen: boolean;
  previewOpen: boolean;
  /**
   * 产物栏此刻有没有东西可看。没有就把按钮一起收起来 ——
   * 一个点了什么都不发生的按钮，比没有这个按钮更让人困惑。
   */
  showPreview?: boolean;
  onToggleNav: () => void;
  onTogglePreview: () => void;
  onNewThread: () => void;
};

/**
 * 顶栏。
 *
 * 三个图标按钮（左栏 / 右栏 / 主题）统一走 `IconButton` —— 它们的位置挨得很近，
 * 尺寸或 hover 底色差一点就会被看出来是"拼的"。
 * 会话标题用 `text-fg-muted` 而不是正文色：它是"当前在哪"的定位信息，
 * 不该和页面里真正的内容抢注意力。
 */
export function TopBar({
  title,
  navOpen,
  previewOpen,
  showPreview = true,
  onToggleNav,
  onTogglePreview,
  onNewThread,
}: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border bg-surface px-3">
      <Tooltip label={navOpen ? "收起历史栏" : "展开历史栏"} side="bottom">
        <IconButton label="切换历史栏" active={navOpen} onClick={onToggleNav}>
          <PanelLeft className="h-4 w-4" />
        </IconButton>
      </Tooltip>

      <Link href="/" className="flex items-center gap-2">
        <span className="t-grad grid h-7 w-7 place-items-center rounded-control text-accent-fg">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="hidden font-display text-base font-semibold text-fg sm:inline">
          智绘课堂
        </span>
      </Link>

      <span className="hidden h-5 w-px bg-border md:block" />
      <h1 className="hidden min-w-0 flex-1 truncate text-sm text-fg-muted md:block">{title}</h1>
      <div className="flex-1 md:hidden" />

      <Button size="sm" variant="outline" onClick={onNewThread}>
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">新建</span>
      </Button>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <ThemeToggle />

        {showPreview ? (
          <Tooltip label={previewOpen ? "收起预览栏" : "展开预览栏"} side="bottom">
            <IconButton label="切换预览栏" active={previewOpen} onClick={onTogglePreview}>
              <PanelRight className="h-4 w-4" />
            </IconButton>
          </Tooltip>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-0.5 shrink-0 rounded-pill" aria-label="账号与设置">
              <Avatar fallback="学" className="h-8 w-8" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>测试账号（不发真邮件）</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">画像与偏好设置</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/pricing">配额与套餐</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/login">切换账号</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
