"use client";

import { Images, RefreshCw, ServerCrash, UserRound } from "lucide-react";

import { EmptyState } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import type { GalleryItem, GalleryScope } from "@/lib/api";

import { GalleryCard } from "./GalleryCard";

type Props = {
  items: GalleryItem[];
  loading: boolean;
  /** 读取失败的原因（空串 = 没失败）。**必须与"空"分开表达** */
  error: string;
  scope: GalleryScope;
  expandedId: string | null;
  loggedIn: boolean;
  onToggle: (threadId: string) => void;
  onRetry: () => void;
  onPublishedChange: (threadId: string, on: boolean) => void;
};

/**
 * 画廊网格。
 *
 * 三种"没有卡片可看"的情形**必须长得不一样**，因为用户该做的事完全不同
 * （这条规矩来自 EmptyState 的注释，这里是最典型的场景）：
 *   · 连不上服务 → 说清"是服务不可用"并给重试按钮，否则会被当成"功能没做"；
 *   · 「我的」为空 → 指出去哪儿发布（工作台的分享弹窗），否则用户找不到入口；
 *   · 「全部」为空 → 就是还没有人发布，不需要给动作。
 *
 * 布局走全站统一的 `.card-grid`（比例列宽，不写死断点）——
 * 项目里有一条明确的告诫：改回 `sm:grid-cols-3` 会让"列数由窗口决定、
 * 卡片宽度由容器决定"，于是同一页在不同宽度下呈现完全不同的卡片比例。
 */
export function GalleryGrid({
  items,
  loading,
  error,
  scope,
  expandedId,
  loggedIn,
  onToggle,
  onRetry,
  onPublishedChange,
}: Props) {
  if (loading) {
    return (
      <div className="card-grid" aria-busy="true" aria-label="正在加载作品">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-card border border-border bg-surface shadow-card"
          >
            {/* 骨架按真实卡片的**结构**铺（16:9 封面 + 两行文字），
                不是随便几块灰条 —— 加载完成时的跳变才小 */}
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-card border border-border bg-surface shadow-card">
        <EmptyState
          className="py-12"
          icon={<ServerCrash className="h-5 w-5" />}
          title="暂时连不上服务"
          desc="作品墙要连上后端才能打开。稍等片刻再试一次；如果一直这样，可能是服务没有启动。"
          action={
            <Button variant="outline" size="sm" className="mt-1" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5" />
              重新加载
            </Button>
          }
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface shadow-card">
        {scope === "mine" ? (
          <EmptyState
            className="py-12"
            icon={<UserRound className="h-5 w-5" />}
            title="你还没有发布过作品"
            desc={
              loggedIn
                ? "在创作台里打开任一已成片的讲解，点分享，把「发布到画廊」打开，它就会出现在这里。"
                : "登录后就能把自己的讲解发布到作品墙。"
            }
            action={
              <Button variant="outline" size="sm" className="mt-1" asChild>
                <a href="/app">去创作台</a>
              </Button>
            }
          />
        ) : (
          <EmptyState
            className="py-12"
            icon={<Images className="h-5 w-5" />}
            title="还没有人发布过作品"
            desc="等第一条作品被发布出来，这里就会热闹起来。你也可以先发一条。"
            action={
              <Button variant="outline" size="sm" className="mt-1" asChild>
                <a href="/app">做一段讲解</a>
              </Button>
            }
          />
        )}
      </div>
    );
  }

  return (
    // `items-start`：卡片高度不必拉平（展开态的那张会变高），
    // 拉平会让展开时整行跟着抖一下
    <div className="card-grid items-start">
      {items.map((it) => (
        <GalleryCard
          key={it.threadId}
          item={it}
          expanded={expandedId === it.threadId}
          onToggle={() => onToggle(it.threadId)}
          onPublishedChange={onPublishedChange}
        />
      ))}
    </div>
  );
}
