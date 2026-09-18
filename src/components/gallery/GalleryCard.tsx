"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Play } from "lucide-react";

import { Badge } from "@/components/ui/primitives";
import { fetchGalleryItem, type GalleryItem } from "@/lib/api";
import type { SceneRender } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-ui";
import { VideoPlayer } from "@/components/workbench/VideoPlayer";

type Props = {
  item: GalleryItem;
  /** 展开时就地播放（同一个时刻只有一张卡是展开的，由父层保证） */
  expanded: boolean;
  onToggle: () => void;
  onPublishedChange: (threadId: string, on: boolean) => void;
};

/** 悬停多久才开预览。太短会"鼠标路过就出声"，太长又像没反应 */
const PREVIEW_DELAY = 350;

/**
 * 画廊卡片。
 *
 * 三种形态，同一张卡原位切换（不跳页、不弹窗 —— 这是产品明确要的）：
 *   1. 封面态：首帧 + 时长角标 + 标题 + 作者；
 *   2. 预览态：鼠标停留 350ms 后，封面视频**静音循环**播放（仅 hover 设备）；
 *   3. 展开态：点击后原位换成完整播放器（分镜级进度、倍速、全屏）。
 *
 * ⚠️ 封面直接拿成片当 `<video>` 用 `#t=0.1` 停在第一帧，而不是做一个缩略图机制：
 *    项目**没有**任何缩略图/封面落盘（全仓搜 poster 无结果），
 *    为画廊单独造一套生成与缓存，等于多一个"封面过期了但视频更新了"的失效面。
 *    `#t=` 与 `?v=<mtime>` 可以共存（缓存戳在查询串，时间点在 hash），
 *    ArtifactPanel 的产物缩略图已经是同款做法。
 *
 * ⚠️ 预览必须同时满足两个条件才开：`(hover: hover)` 且非 `prefers-reduced-motion`。
 *    触摸设备上 hover 不存在（有的浏览器会用"点一下"伪造 hover，于是点击展开的同时
 *    又触发了预览）；而自动播放对动效敏感的用户就是一种打扰。
 */
export function GalleryCard({ item, expanded, onToggle, onPublishedChange }: Props) {
  const canHover = useMediaQuery("(hover: hover)");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const previewOk = canHover && !reduceMotion && item.playable;

  /** 鼠标停留够久了（定时器在**事件处理函数**里，不在 effect 里，见下） */
  const [dwelled, setDwelled] = useState(false);
  const dwellTimer = useRef<number | null>(null);
  const coverRef = useRef<HTMLVideoElement | null>(null);
  /** 浏览器拒绝了自动播放（省电模式等）。拒绝后别再反复试 */
  const [previewBlocked, setPreviewBlocked] = useState(false);

  /** 展开后取回的分段。**懒加载**：不点开就永远不请求 */
  const [detail, setDetail] = useState<SceneRender[] | null>(null);
  /** 分段请求是否已经发起过。用 ref 而不是 state：它只是个"别再发一次"的闸门 */
  const requested = useRef(false);
  const [detailError, setDetailError] = useState("");

  /*
   * 该不该在预览：**派生值**，不另存一份 state。
   *
   * ⚠️ 写成 `useState` + effect 同步（`if (!hovering) setPreviewing(false)`）是
   *    这个仓库明确禁止的形态（`react-hooks/set-state-in-effect`），而且它背后的
   *    代价在这儿是真实的：鼠标每次划过都多一轮渲染。
   *    这里几个条件全部来自已有状态，直接算出来即可，一行 effect 都不需要。
   */
  const shouldPreview = previewOk && dwelled && !expanded && !previewBlocked;

  /*
   * 悬停的进出**全部由鼠标事件驱动**，不经过 state + effect：
   *   · 鼠标进入 → 起一个 350ms 的定时器，到点才 `setDwelled(true)`；
   *   · 鼠标离开 → 撤掉定时器并立刻 `setDwelled(false)`。
   *
   * 为什么不用 `hovering` state + effect 延迟：那要"同步 state、再由 effect
   * 响应"，也就是级联渲染 —— 鼠标横穿一排卡片会触发一串无谓的重渲染。
   * 事件处理函数里 setState 是 React 的标准用法，没有这个问题。
   */
  function onEnter() {
    if (!previewOk || expanded) return;
    if (dwellTimer.current !== null) window.clearTimeout(dwellTimer.current);
    dwellTimer.current = window.setTimeout(() => setDwelled(true), PREVIEW_DELAY);
  }

  function onLeave() {
    if (dwellTimer.current !== null) {
      window.clearTimeout(dwellTimer.current);
      dwellTimer.current = null;
    }
    setDwelled(false);
  }

  // 组件卸载时清掉挂着的定时器。**必须清**：不清的话鼠标划过之后立刻切页，
  // 那个定时器会在组件已经卸载后触发一次 setState（React 会警告内存泄漏）。
  useEffect(() => {
    return () => {
      if (dwellTimer.current !== null) window.clearTimeout(dwellTimer.current);
    };
  }, []);

  /* ---------------- 播 / 停封面视频 ---------------- */
  useEffect(() => {
    const el = coverRef.current;
    if (!el) return;
    if (shouldPreview) {
      // 静音是**必须**的：不静音的话浏览器压根不允许自动播放（autoplay 策略），
      // 而且一个鼠标路过就出声的页面是灾难。
      el.muted = true;
      el.play().catch(() => {
        // 被拒（省电模式 / 系统策略）。标下来，别在每次 hover 时反复试 ——
        // 那既没有用，又会在控制台刷一片 rejection。
        setPreviewBlocked(true);
      });
    } else {
      el.pause();
      // 回到首帧。不重置的话卡片会停在一个随机画面上，看起来像封面各不相同
      el.currentTime = 0;
    }
  }, [shouldPreview]);

  /* ---------------- 展开时拉分段 ---------------- */
  useEffect(() => {
    // 闸门用 **ref** 而不是 `detail` / 某个 state：
    // 用 state 做守卫会带来两种坏结果 ——
    //   1. 请求失败后 `detail` 永远是 null，effect 会反复重发（一个坏掉的作品被无限重连，而它不会自己好）；
    //   2. 为了守卫而"在 effect 体里置一个 loading state"会直接违反 set-state-in-effect。
    // ref 是同步的，在 effect 体里读它、改它都不会触发渲染。
    if (!expanded || requested.current) return;
    requested.current = true;
    let alive = true;
    void fetchGalleryItem(item.threadId)
      .then((d) => {
        if (!alive) return;
        setDetail(
          d.segments.map((s) => ({
            index: s.index,
            title: s.title,
            status: "done" as const,
            url: s.url,
            durationSec: s.durationSec,
          })),
        );
      })
      .catch((err: unknown) => {
        if (alive) setDetailError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [expanded, item.threadId]);

  const previewing = shouldPreview;

  const author = item.author || "匿名作者";

  return (
    <article
      className={cn(
        "t-lift group overflow-hidden rounded-card border border-border bg-surface shadow-card",
        "hover:border-accent/40",
        expanded && "border-accent/50",
      )}
      /*
       * 悬停进出直接驱动"延迟预览"，中间没有 state 中转（见 onEnter / onLeave 的说明）。
       *
       * ⚠️ 刻意**不接 onFocus / onBlur**：React 的焦点事件是冒泡的，
       *    键盘 Tab 到卡片里的按钮时会触发一次 focus→blur→focus，
       *    于是"用键盘浏览作品墙"会一路自动起播预览 —— 那不是键盘用户要的。
       *    悬停预览的前提本来就是"指针停在上面"，键盘路径走直接点开播放。
       */
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* ------------------------------ 画面 ------------------------------ */}
      <div className="relative aspect-video w-full overflow-hidden bg-video">
        {expanded && detail ? (
          /*
            展开态用**同一个** VideoPlayer（内联/右栏/全屏三处已经共用它）：
            控件手感、进度条语义、静音策略一次性全对，不必在这里重写一套
            "简版播放器"（那正是这个项目反复收敛掉的东西）。
          */
          <VideoPlayer
            scenes={detail}
            total={detail.length}
            resetKey={item.threadId}
            /*
             * ⚠️ 用 `panel` 而不是 `stage`，虽然这一张卡此刻是"主角"。
             *    两者的唯一差别是**起播是否静音**（见 PlayerVariant 的说明），
             *    而 `stage` 是"带声音自动起播" —— 浏览器的 autoplay 策略对
             *    带声自动播放卡得很紧，被拒时 `play()` 会失败、播放器如实
             *    退回暂停态，表现就是"点开什么都不动"。作品墙上十几张卡，
             *    静音起播（用户想听再点音量）才是对的那一档。
             */
            variant="panel"
            finalUrl={item.videoUrl}
            title={item.title}
            threadId={item.threadId}
            published={item.mine}
            onPublishedChange={(on) => onPublishedChange(item.threadId, on)}
            // 只有作者才有「分享 / 发布」：别人的作品上挂一个注定被后端拒绝的
            // 分享按钮，用户只会看到"分享失败"而不知道为什么（见 Props.canShare）
            canShare={item.mine}
          />
        ) : expanded ? (
          <div className="grid h-full place-items-center text-white/60">
            {detailError ? (
              <span className="flex flex-col items-center gap-2 px-6 text-center">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-xs leading-relaxed">{detailError}</span>
              </span>
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
          </div>
        ) : (
          <>
            {item.playable ? (
              <video
                ref={coverRef}
                src={`${item.videoUrl}#t=0.1`}
                muted
                playsInline
                loop
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : (
              /*
                ⚠️ 视频不可用（被 TTL 清理等）时**保留卡片**并说明原因，
                而不是把它从列表里悄悄拿掉：作者明明发布过，
                页面上却什么都没有，只会让人以为作品被删了。
                这是这个项目一贯的"诚实降级"。
              */
              <div className="grid h-full place-items-center px-6 text-center text-white/55">
                <span className="flex flex-col items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-xs leading-relaxed">
                    这段视频暂时不可用（可能已被清理）
                  </span>
                </span>
              </div>
            )}

            {/* 播放三角浮层：明确"这里可以点"。只在可播放且未预览时出现，
                预览开着的时候再盖一层三角会挡住画面 */}
            {item.playable && !previewing ? (
              <span className="pointer-events-none absolute inset-0 grid place-items-center">
                <span
                  className={cn(
                    "t-tx grid h-12 w-12 place-items-center rounded-pill bg-black/60 text-white backdrop-blur",
                    "opacity-0 group-hover:opacity-100",
                  )}
                >
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                </span>
              </span>
            ) : null}

            {/* 时长角标 */}
            {item.durationSec > 0 ? (
              <span className="tnum absolute bottom-2 right-2 rounded-pill bg-black/70 px-2 py-0.5 text-xs text-white/90">
                {formatDuration(item.durationSec)}
              </span>
            ) : null}

            {/* 「我的」徽章：橙色只出现在这类信号上 */}
            {item.mine ? (
              <span className="absolute left-2 top-2">
                <Badge tone="accent">我的</Badge>
              </span>
            ) : null}
          </>
        )}

        {/*
          整块画面是一个**按钮**：点击在卡片内展开/收回。
          用 button 而不是可点的 div —— 键盘可达、读屏能念出动作，
          这些来自元素本身（见 primitives 里 Switch 的同一条理由）。
        */}
        {!expanded ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={!item.playable}
            aria-label={`播放《${item.title}》`}
            className={cn(
              "absolute inset-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus",
              item.playable ? "cursor-pointer" : "cursor-not-allowed",
            )}
          />
        ) : null}
      </div>

      {/* ------------------------------ 信息 ------------------------------ */}
      <div className="p-3">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 truncate font-heading text-sm font-medium text-fg">
            {item.title}
          </h3>
          {expanded ? (
            <button
              type="button"
              onClick={onToggle}
              className="t-tx shrink-0 rounded-control px-2 py-0.5 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              收起
            </button>
          ) : null}
        </div>

        <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-subtle">
          {/* 作者首字头像：没有头像系统，用首字是最省事又不撒谎的表达 */}
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-pill bg-surface-2 text-[10px] text-fg-muted">
            {author.slice(0, 1)}
          </span>
          <span className="truncate">{author}</span>
          <span className="text-border">·</span>
          <span className="tnum shrink-0">{item.sceneCount} 个分镜</span>
          <span className="ml-auto shrink-0" suppressHydrationWarning>
            {relative(item.publishedAt)}
          </span>
        </p>
      </div>
    </article>
  );
}

/**
 * 相对时间。发布时间的绝对值对浏览者没有信息量，"3 小时前"才说明新鲜度。
 *
 * ⚠️ 依赖 `Date.now()`，服务端与 hydration 之间可能跨过档位边界 → 显式豁免
 *    （调用点上加了 `suppressHydrationWarning`）。
 */
function relative(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  return day < 30 ? `${day} 天前` : `${Math.floor(day / 30)} 个月前`;
}
