"use client";

import Link from "next/link";
import { PanelLeft, PanelRight, Plus, Sparkles } from "lucide-react";

import { Avatar } from "@/components/ui/fragments";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/popover";

type Props = {
  title: string;
  navOpen: boolean;
  previewOpen: boolean;
  onToggleNav: () => void;
  onTogglePreview: () => void;
  onNewThread: () => void;
};

export function TopBar({
  title,
  navOpen,
  previewOpen,
  onToggleNav,
  onTogglePreview,
  onNewThread,
}: Props) {
  return (
    <header className="flex h-[3.85rem] shrink-0 items-center gap-3 border-b border-line bg-surface px-3.5">
      <button
        onClick={onToggleNav}
        aria-label="切换历史栏"
        className="grid h-10 w-10 place-items-center rounded-md text-ink-soft transition-colors hover:bg-canvas hover:text-navy-900 data-[open=true]:bg-canvas"
        data-open={navOpen}
      >
        <PanelLeft className="h-4.5 w-4.5" />
      </button>

      <Link href="/" className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded bg-navy-900 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="hidden font-serif-cn text-base font-semibold text-navy-900 sm:inline">
          Manimatic
        </span>
      </Link>

      <span className="hidden h-5 w-px bg-line md:block" />
      <h1 className="hidden min-w-0 flex-1 truncate font-serif-cn text-sm text-navy-900 md:block">
        {title}
      </h1>
      <div className="flex-1 md:hidden" />

      <Button size="sm" variant="outline" onClick={onNewThread} className="gap-1.5">
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">新建</span>
      </Button>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <Tooltip label={previewOpen ? "收起预览栏" : "展开预览栏"}>
          <button
            onClick={onTogglePreview}
            aria-label="切换预览栏"
            className="grid h-10 w-10 place-items-center rounded-md text-ink-soft transition-colors hover:bg-canvas hover:text-navy-900 data-[open=true]:bg-canvas"
            data-open={previewOpen}
          >
            <PanelRight className="h-4.5 w-4.5" />
          </button>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1">
              <Avatar fallback="学" />
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
