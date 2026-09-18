"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, Images, Link2, Link2Off, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, SwitchVisual } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { setThreadGallery, setThreadShare, USE_MOCK } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  onClose: () => void;
  title: string;
  /** 成片地址：用于下载 */
  finalUrl?: string;
  /**
   * 会话 id。**给了它这个弹窗才做真事**：去后端开分享链接、发布到画廊。
   *
   * ⚠️ 不给（比如播放器在没有会话上下文的地方被复用）时退化成"只展示链接 + 下载"
   *    的静态弹窗 —— 这是刻意的向后兼容，而不是"功能缺失"：
   *    让一个不知道自己在哪条会话里的弹窗去联网，只会拿到 404，
   *    而用户看到的是"分享失败"，他没有任何办法知道为什么。
   */
  threadId?: string;
  /** 已有的公开分享地址（调用方已经生成过时传进来，免得重复申请一个） */
  shareUrl?: string;
  /** 已发布到画廊 */
  published?: boolean;
  /** 有没有成片。没有成片就不该发布 —— 画廊卡片是一张封面，空条目比看不到更糟 */
  canPublish?: boolean;
  /** 分享开关状态变化（父层据此更新侧栏那个小标记） */
  onSharedChange?: (on: boolean) => void;
  /** 发布状态变化（同上） */
  onPublishedChange?: (on: boolean) => void;
};

/**
 * 分享弹窗 —— 全站**唯一**的一份。
 *
 * 它承担两件互相独立、但都属于"把这段讲解交出去"的事：
 *   1. 公开链接：给知道链接的人看（token 可撤销）；
 *   2. 发布到画廊：摆到公开的作品墙上（所有人可见、可撤下）。
 *
 * ⚠️ 为什么这两件事必须并列在这一个弹窗里，而不是各做一个入口：
 *    它们回答的是同一个问题（"这段视频给谁看"），只是范围不同（一个人 / 所有人）。
 *    分开放的结果是用户看完一圈还得自己推理"到底哪个才是公开发出去"。
 *
 * ⚠️ 它曾经有两份实现（Workbench 里一个内联 Dialog、这里一个组件），
 *    那份内联的还带着自己的分享/取消分享逻辑。两份必然发散 ——
 *    这次要加"发布到画廊"，如果只改一处，另一个入口就永远发不出去，
 *    而这种"某个入口少一个开关"的问题极难被当成 bug 报出来。
 *    所以现在**只有一个来源**：操作也一并收进这里（见 useEffect 里的开分享）。
 *
 * ⚠️ 调用方要**条件挂载**（`{open && <ShareDialog/>}`），不要用 `open` prop：
 * 这样"已复制"状态和链接会随关闭一起销毁，不需要额外的 effect 去重置
 * （在 effect 里同步 setState 会触发级联渲染，react-hooks 规则直接报错）。
 */
export function ShareDialog({
  onClose,
  title,
  finalUrl,
  threadId,
  shareUrl,
  published = false,
  canPublish = true,
  onSharedChange,
  onPublishedChange,
}: Props) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  /**
   * 分享地址。
   *
   * 惰性初始化：调用方已经知道链接（`shareUrl`）就直接用；
   * 否则先给一个**演示用**的占位（`USE_MOCK` 或没有 threadId 的场合）——
   * 真正的链接由下面的 effect 去换。
   */
  const [url, setUrl] = useState(
    () =>
      shareUrl ??
      (typeof window === "undefined"
        ? ""
        : `${window.location.origin}/share/demo-${Date.now().toString(36)}`),
  );
  /**
   * 正在申请的分享链接（true 时链接区显示占位而不是一个会变的假地址）。
   *
   * ⚠️ 初值**就是**"这个弹窗需不需要去申请链接"这个判据本身，所以下面那个 effect
   *    在"不需要申请"的分支里可以**直接 return，不必同步 setState(false)** ——
   *    那种写法会触发级联渲染，被 `react-hooks/set-state-in-effect` 拦下。
   *    弹窗是条件挂载的（打开时才创建），threadId 在一次生命周期里不会变，
   *    所以"初值可能过时"这件事不会发生。
   */
  const [preparing, setPreparing] = useState(Boolean(threadId) && !shareUrl && !USE_MOCK);
  const [publishBusy, setPublishBusy] = useState(false);
  /** 链接没申请成功（降级成了一个临时地址）。文案要说出来，否则用户会拿去发 */
  const [failedShare, setFailedShare] = useState(false);

  /**
   * 开分享（只在"有会话、又还没有链接"时做一次）。
   *
   * ⚠️ 这里**不再由调用方先建链接再开弹窗**：那样"建链接"这件事就落在
   *    每个入口手里，而入口有四个（侧栏、内联卡片、右栏详情、移动端抽屉）。
   *    收在这里之后，"点分享 = 拿到一个可用链接"这个因果关系只有一处实现。
   *
   * ⚠️ 失败时**不弹错、不关弹窗**：失败的是"链接"，其余两件事
   *    （下载成片、发布到画廊）照常可用。把整个弹窗报错关掉，
   *    等于顺手把两个还能用的功能一起废了。
   */
  useEffect(() => {
    // 不需要申请链接（没会话 / 已经有了 / 演示模式）：**直接返回**。
    // 这里刻意不写 `setPreparing(false)` —— 初值已经保证了此时它就是 false，
    // 而在 effect 体里同步 setState 会触发级联渲染（规则也会报错）。
    if (!threadId || shareUrl || USE_MOCK) return;
    let alive = true;
    void (async () => {
      try {
        const r = await setThreadShare(threadId, true);
        if (!alive) return;
        if (!r.ok || !r.slug) throw new Error(r.error || "生成分享链接失败");
        // 链接在前端拼：后端只知道自己的地址（那是 media 的前缀），不知道前端端口。
        setUrl(`${window.location.origin}/share/${r.slug}`);
        onSharedChange?.(true);
      } catch (err) {
        if (!alive) return;
        // 退化成演示链接而不是留一个空白框：用户至少还能复制点东西，
        // 而且下面那行说明会告诉他"这个链接是临时的"。
        setUrl(`${window.location.origin}/share/demo-${Date.now().toString(36)}`);
        setFailedShare(true);
        console.error("[share] 生成分享链接失败", err);
      } finally {
        if (alive) setPreparing(false);
      }
    })();
    return () => {
      alive = false;
    };
    // onSharedChange 不进依赖：它是父层的内联回调，每次渲染都是新引用，
    // 放进去会让这个 effect 反复重跑 —— 表现是"链接被反复重新申请"。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, shareUrl]);

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

  async function unshare() {
    if (!threadId || USE_MOCK) {
      onClose();
      return;
    }
    try {
      const r = await setThreadShare(threadId, false);
      if (!r.ok) throw new Error(r.error || "取消分享失败");
      onSharedChange?.(false);
      toast("已取消分享，原来的链接立即失效");
      onClose();
    } catch (err) {
      toast(`取消分享失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function togglePublish(next: boolean) {
    if (!threadId) return;
    setPublishBusy(true);
    try {
      const r = await setThreadGallery(threadId, next);
      if (!r.ok) throw new Error(r.error || (next ? "发布失败" : "撤下失败"));
      onPublishedChange?.(Boolean(r.published));
      toast(next ? "已发布到画廊，所有人都能在作品墙看到" : "已从画廊撤下");
    } catch (err) {
      toast(`${next ? "发布" : "撤下"}失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPublishBusy(false);
    }
  }

  /** 画廊这一行只有"知道自己是哪条会话"时才存在（见 Props.threadId 的说明） */
  const showGallery = Boolean(threadId);
  /** 演示模式没有真实账号与后端，开关给了也点不动 —— 说清原因比禁用一个按钮好 */
  const galleryDisabled = USE_MOCK || publishBusy || (!published && !canPublish);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>分享这段讲解</DialogTitle>
        </DialogHeader>

        <p className="truncate text-sm text-fg-muted" title={title}>
          {title}
        </p>

        {/* ------------------------- 公开链接 ------------------------- */}
        <label className="mt-3 block text-xs font-medium text-fg-muted" htmlFor="share-url">
          分享链接
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <Input
            id="share-url"
            readOnly
            value={preparing ? "" : url}
            placeholder={preparing ? "正在生成链接…" : undefined}
            onFocus={(e) => e.currentTarget.select()}
            // 只读字段用内嵌面色：它不该看起来像个可以随手改的输入框
            className="tnum h-10 min-w-0 flex-1 bg-surface-2 text-xs"
          />
          <Button size="md" onClick={copy} disabled={preparing} className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "已复制" : "复制"}
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-fg-muted">
          {failedShare
            ? "链接没能生成（服务暂时不可用），这个地址是临时的 —— 稍后再试一次。"
            : "拿到链接的人可以直接观看，无需登录。"}
        </p>

        {/* ------------------------- 发布到画廊 ------------------------- */}
        {showGallery ? (
          <div className="mt-4 flex items-start gap-3 rounded-inner border border-border bg-surface-2 p-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-inner border border-border bg-surface text-fg-muted">
              <Images className="h-4 w-4" />
            </span>
            {/*
              整块（图标 + 文字 + 滑块）就是**一个** `role="switch"` 按钮：
              只让那个 20px 的小滑块可点，是移动端最容易点不到的东西，
              而这一行本来也只有一个动作。滑块走 `SwitchVisual`
              （纯展示），避免"按钮里再嵌一个按钮"。
            */}
            <button
              type="button"
              role="switch"
              aria-checked={published}
              aria-label="发布到画廊"
              disabled={galleryDisabled}
              onClick={() => void togglePublish(!published)}
              className={cn(
                "flex min-w-0 flex-1 items-start gap-3 rounded-inner text-left",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus",
                galleryDisabled ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-inner border border-border bg-surface text-fg-muted">
                <Images className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-heading text-sm font-medium text-fg">发布到画廊</span>
                  {publishBusy ? (
                    <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-fg-subtle" />
                  ) : (
                    <span className="ml-auto shrink-0">
                      <SwitchVisual checked={published} disabled={galleryDisabled} />
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-fg-muted">
                  {USE_MOCK
                    ? "演示模式下没有真实账号与后端，发布不可用。"
                    : !published && !canPublish
                      ? "这条讲解还没有渲染出成片，渲完就能发布。"
                      : published
                        ? "正在作品墙上展示。撤下后立即从画廊消失。"
                        : "作品墙上的所有人都能看到这段成片，作者名会显示你的账号名。"}
                </span>
              </span>
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {finalUrl ? (
            <Button size="sm" variant="outline" asChild>
              <a href={finalUrl} download>
                <Download className="h-4 w-4" />
                下载 MP4
              </a>
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-fg-muted">
              <Download className="h-3.5 w-3.5" />
              整片合成完成后可下载
            </span>
          )}

          {/*
            取消分享只在**真的开着分享**时出现：一个"取消分享"按钮配一条根本没生效过的
            链接，会让人以为链接一直在公开着（而它从来没存在过）。
          */}
          {threadId && !USE_MOCK && !preparing && !failedShare ? (
            <Button size="sm" variant="ghost" onClick={() => void unshare()}>
              <Link2Off className="h-3.5 w-3.5" />
              取消分享
            </Button>
          ) : null}

          <span className="ml-auto flex items-center gap-1.5 text-xs text-fg-muted">
            {copied ? (
              <Link2 className="h-3.5 w-3.5 text-ok" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {copied ? "链接已复制到剪贴板" : "可粘贴到微信 / 邮件 / 文档"}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
