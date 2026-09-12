"use client";

import { useState } from "react";
import { Check, Copy, Download, Link2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  onClose: () => void;
  title: string;
  /** 成片地址：用于下载 */
  finalUrl?: string;
  /** 已有的公开分享地址；没有就现生成一个（当前是本地伪链接） */
  shareUrl?: string;
};

/**
 * 分享弹窗。
 *
 * 之前"分享"是直接 `navigator.clipboard.writeText` 一个链接就完事，用户看不到
 * 发生了什么的全部信息，也没有下载入口。现在集中成一个弹窗：显示链接、一键复制、
 * 下载成片 —— 分享与下载本来就是同一件事的两个动作。
 *
 * ⚠️ 调用方要**条件挂载**（`{open && <ShareDialog/>}`），不要用 `open` prop：
 * 这样"已复制"状态和链接会随关闭一起销毁，不需要额外的 effect 去重置
 * （在 effect 里同步 setState 会触发级联渲染，react-hooks 规则直接报错）。
 */
export function ShareDialog({ onClose, title, finalUrl, shareUrl }: Props) {
  const [copied, setCopied] = useState(false);
  // 惰性初始化：分享地址里带时间戳，每次打开给一个新的
  const [url] = useState(
    () =>
      shareUrl ??
      (typeof window === "undefined"
        ? ""
        : `${window.location.origin}/share/demo-${Date.now().toString(36)}`),
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板被拒（非 https / 无权限）时至少让用户能手动选中复制
      setCopied(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>分享这段讲解</DialogTitle>
        </DialogHeader>

        <p className="truncate text-sm text-ink-soft" title={title}>
          {title}
        </p>

        <label className="mt-3 block text-xs font-medium text-ink-soft">分享链接</label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="tnum h-10 min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 text-xs text-ink outline-none focus:border-brick-600"
          />
          <Button size="sm" onClick={copy} className="h-10 shrink-0 gap-1.5">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "已复制" : "复制"}
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-ink-soft">拿到链接的人可以直接观看，无需登录。</p>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {finalUrl ? (
            <Button size="sm" variant="outline" asChild className="gap-1.5">
              <a href={finalUrl} download>
                <Download className="h-4 w-4" />
                下载 MP4
              </a>
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-ink-soft">
              <Download className="h-3.5 w-3.5" />
              整片合成完成后可下载
            </span>
          )}

          <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-soft">
            {copied ? <Link2 className="h-3.5 w-3.5 text-ok-600" /> : <Send className="h-3.5 w-3.5" />}
            {copied ? "链接已复制到剪贴板" : "可粘贴到微信 / 邮件 / 文档"}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
