"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Info,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";

import { useTimelinePlayer, type TimelinePlayerApi } from "@/lib/playback";
import { isFullscreenElement, toggleFullscreen } from "@/lib/fullscreen";
import type { SceneRender } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-ui";

import { ShareDialog } from "./ShareDialog";
import { TimelineScrubber } from "./TimelineScrubber";

const SPEEDS = [0.5, 1, 1.5, 2];

/**
 * 播放器形态。
 *
 * ⚠️ 形态**只影响"起播是否静音"**（内联/右栏必须静音才能被浏览器允许自动播放，
 * 全屏应带声音）与"是否给一个进详情的入口"，**控件层完全相同**。
 *
 * 曾经按形态裁过控件（内联只给播放/进度/时间/全屏），结果是同一个播放器嵌在对话里
 * 就少了倍速和音量 —— 用户没有理由理解这种差异，而且"三处观感统一"本来就是这次改造
 * 的目标。要精简也只该按**屏幕宽度**精简（窄屏隐藏倍速），不该按摆放位置精简。
 */
export type PlayerVariant = "inline" | "panel" | "stage";

type Props = {
  scenes: SceneRender[];
  /** 大纲里的分镜总数（含未就绪的）；不给就用 scenes.length */
  total?: number;
  /** 换消息/换产物时重置播放头 */
  resetKey?: string;
  variant?: PlayerVariant;
  /** 成片地址：只用于分享/下载，不参与播放（播放走分镜拼接，长度才和进度条一致） */
  finalUrl?: string;
  /** 分享弹窗里展示的标题 */
  title?: string;
  /**
   * 提供后，控件层右上角会出现「详情」按钮。
   * 点击画面**只做播放/暂停**，所以要打开右栏详情必须有个明确的入口，
   * 不能让"点视频"同时承担两个动作。
   */
  onOpenDetail?: () => void;
  className?: string;
  /** 打开时定位到哪个分镜 */
  initialSceneIndex?: number | null;
  /** 外部想操作播放器时（如详情页的分镜列表要 seek）用它拿句柄 */
  onPlayerReady?: (player: TimelinePlayerApi) => void;
};

/**
 * 三处视频展示共用的播放器。
 *
 * 为什么要抽出来：内联卡片 / 右栏 / 全屏原本各拼一套 `<video>` + 进度条，
 * 于是出现了"小窗没有暂停键""全屏像详情""进度条位置不一致"这类问题 ——
 * 三套实现必然发散。这里收敛成一套「画面 + 悬浮控件层」，三处的交互与控件完全一致。
 *
 * 交互约定（对齐主流播放器的肌肉记忆）：
 *   - 点击画面 = 播放/暂停
 *   - 悬停/触摸时浮出控件层，鼠标移开自动淡出（暂停时保持显示，否则没法点）
 *   - 全屏按钮在右下角，进的是**浏览器真全屏**（见 lib/fullscreen.ts）
 */
export function VideoPlayer({
  scenes,
  total,
  resetKey,
  variant = "inline",
  finalUrl,
  title = "讲解视频",
  onOpenDetail,
  className,
  initialSceneIndex,
  onPlayerReady,
}: Props) {
  const stage0 = variant === "stage";
  /*
   * 音量/静音完全交给 hook 管（它持有 <video> 元素，换段时也要重新应用一次）。
   * 组件这一层只传"起播是否静音"，绝不自己去写 videoEl.muted —— 两处都写会互相覆盖。
   */
  const player = useTimelinePlayer(scenes, resetKey, { defaultMuted: !stage0 });
  const {
    bindA,
    bindB,
    activeSide,
    timeline,
    activeIndex,
    playing,
    globalTime,
    waitingFor,
    volume,
    muted,
    speed,
    seekTo,
    seekToScene,
    toggle,
    replay,
    setVolume,
    setSpeed,
    toggleMute,
    unmute,
  } = player;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  /**
   * 浏览器不支持容器全屏（部分 iOS Safari）时的降级全屏。
   *
   * 为什么不干脆弹一个 Dialog 当全屏：那正是用户否掉的形态 ——
   * "现在全屏是伪全屏，更像详情，不要那种详情了"。降级也不能退回详情弹窗，
   * 而是就地让容器铺满视口（视觉上等同全屏），保持同一套控件层。
   */
  const [fallbackFs, setFallbackFs] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  /** 用户正在拖进度条。拖动期间控件层必须保持可交互，见 `chromeVisible` */
  const [scrubbing, setScrubbing] = useState(false);
  /** 用户是否亲手调过音量：调过就不再强制静音（否则他一改音量就被"重置"回去） */
  const [volumeTouched, setVolumeTouched] = useState(false);

  const canHover = useMediaQuery("(hover: hover)");
  const count = total ?? scenes.length;
  const expanded = fallbackFs;

  /* 全屏状态同步（用户可能按 Esc 或 F11 退出，不能只信自己那一次点击） */
  useEffect(() => {
    const onChange = () => setFullscreen(isFullscreenElement(containerRef.current));
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  /* 打开时就定位到指定分镜 */
  useEffect(() => {
    if (initialSceneIndex === null || initialSceneIndex === undefined) return;
    seekToScene(initialSceneIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSceneIndex]);

  /*
   * 把播放器句柄交给外部（详情页的分镜列表要 seek、要读播放状态）。
   *
   * ⚠️ 每次渲染 `player` 都是新对象（返回值是个字面量），直接依赖它会死循环：
   * 通知外部 → 外部 setState → 播放器重渲染 → 再通知… 所以这里把依赖收窄到
   * "真正会影响外部行为的字段"，且只在它们变化时才同步一次。
   */
  const readyNotify = useRef(onPlayerReady);
  useEffect(() => {
    readyNotify.current = onPlayerReady;
  }, [onPlayerReady]);
  useEffect(() => {
    readyNotify.current?.(player);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, activeIndex, timeline.total, timeline.readyCount]);

  const onToggleFullscreen = useCallback(async () => {
    // 已经在降级全屏里：直接退出
    if (fallbackFs) {
      setFallbackFs(false);
      return;
    }
    const target = containerRef.current;
    const isFs = isFullscreenElement(target);
    const ok = await toggleFullscreen(target);
    if (isFs) return;

    // 真全屏不可用（iOS Safari 等）：降级成"就地铺满视口"，绝不退回详情弹窗。
    if (!ok) setFallbackFs(true);
    // 放大后应当能听见声音 —— 内联/右栏是静音起播的，别让"点全屏还是没声"变成困惑。
    // 用户手动静音过就不动他（volumeTouched）。
    if (!volumeTouched) unmute();
  }, [fallbackFs, volumeTouched, unmute]);

  /* 降级全屏时按 Esc 退出（真全屏由浏览器负责，这里只管降级态） */
  useEffect(() => {
    if (!fallbackFs) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFallbackFs(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fallbackFs]);

  /**
   * 控件层是否可见：
   *   - 触摸设备（没有 hover）常显
   *   - 鼠标悬停时显示
   *   - 暂停时保持显示 —— 否则暂停后想再点播放，得先把鼠标移过去等控件浮出来
   *   - **拖进度条期间保持显示** —— 这条不能省：`onEnded` 换段不会把 `playing`
   *     置回 false（见 `playback.ts` 的 `onEnded`），于是"渲染中自动续播下一段"
   *     时播放器一直是播放态；用户此时去拖进度条，指针一移出画面 `hovered`
   *     立刻变 false，整层控件被设成 `pointer-events-none`，
   *     一次正常的拖动会在半路断掉 —— 这正是"有时候拖不动"的来源。
   *
   * 注意：倍速的悬停卡片不需要在这里额外兜底。它是容器内的绝对定位元素，
   * 鼠标移到它上面时仍在这个播放器容器内，`hovered` 保持为 true。
   */
  const chromeVisible = !canHover || hovered || !playing || scrubbing;

  const waiting = waitingFor !== null;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        // 尺寸由容器自己撑：内部两个 video 都是绝对定位叠放的（双缓冲）
        "group/player relative overflow-hidden bg-video",
        // 播放器不是可选中的文本区：不加这行，拖拽进度条/画面时会把周围的
        // 标题、时间、按钮文字一起框选起来，还会出现拖拽幽灵图
        "select-none",
        fullscreen || expanded ? "h-full w-full" : "aspect-video",
        // 降级全屏：铺满视口并压在最上层，视觉上等同全屏
        expanded && "fixed inset-0 z-[70] h-dvh w-screen",
        className,
      )}
    >
      {/*
        点击层：覆盖整个画面，点击 = 播放/暂停（不再一点就跳全屏或跳详情）。
        它必须是独立的一层，因为底下是两个 video，没法用 button 把它们包起来。
      */}
      <button
        type="button"
        aria-label={playing ? "暂停" : "播放"}
        onClick={toggle}
        className="absolute inset-0 z-10 cursor-pointer outline-none"
      />

      {/*
        双缓冲的两路画面。

        切换用 **z-index 而不是 opacity**：活跃那路压在上面，另一路留在下面垫着。
        这样万一活跃那路还没吐出第一帧（元素未渲染时是透明的），透出来的是下层
        上一段的最后一帧，而不是黑底 —— 肉眼看到的就是完全连续的画面。
        两路都不设背景色，让容器的 `--t-video` 在最底下兜底。

        切换之所以不用换 `src`：`load()` 会**立即清空**正在看的画面（规范行为），
        那正是黑帧的来源。换 z-index 则一个像素都不用重画。

        ⚠️ 不要在这里写 `muted` 属性：React 会在每次渲染时把它重置成 prop 值，
        覆盖 hook 按用户设置写进去的真实静音状态。静音完全由 hook 管。
      */}
      <video
        ref={bindA}
        playsInline
        preload="metadata"
        // 视频默认能被拖着拽出去（浏览器会生成一个半透明快照），显式关掉
        draggable={false}
        className={cn(
          "absolute inset-0 h-full w-full select-none object-contain",
          activeSide === "a" ? "z-[2]" : "z-[1]",
        )}
      />
      <video
        ref={bindB}
        playsInline
        preload="metadata"
        draggable={false}
        className={cn(
          "absolute inset-0 h-full w-full select-none object-contain",
          activeSide === "b" ? "z-[2]" : "z-[1]",
        )}
      />

      {/* 等待下一段渲染完成 */}
      {waiting && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/70 text-center">
          <div>
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-white/80" />
            <p className="tnum mt-2 text-xs text-white/85">等待第 {waitingFor} 分镜渲染完成…</p>
            <p className="mt-0.5 text-xs text-white/50">
              已就绪 {timeline.readyCount}/{count}
            </p>
          </div>
        </div>
      )}

      {/* 中央大播放键：暂停/未播时显示 */}
      {!playing && !waiting && timeline.readyCount > 0 && (
        <button
          type="button"
          onClick={toggle}
          aria-label="播放"
          className="t-tx absolute left-1/2 top-1/2 z-20 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-pill bg-black/55 text-white backdrop-blur hover:bg-black/75"
        >
          <Play className="ml-0.5 h-6 w-6" />
        </button>
      )}

      {/*
        控件层。
        暂停时（!playing）保持显示 —— 否则用户暂停后想再点播放，得先把鼠标移过去
        等控件浮出来，那是一次多余的交互。
      */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-30 flex items-start justify-end gap-1.5 p-2 transition-opacity duration-200",
          chromeVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <span className="pointer-events-none mr-auto max-w-[60%] truncate rounded-control bg-black/55 px-2 py-1 text-xs text-white/90 backdrop-blur">
          {title}
        </span>
        {onOpenDetail && (
          <button
            type="button"
            onClick={onOpenDetail}
            aria-label="查看详情"
            title="查看详情"
            className="t-tx grid h-8 w-8 place-items-center rounded-control bg-black/55 text-white/90 backdrop-blur hover:bg-black/80"
          >
            <Info className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          aria-label="分享"
          title="分享 / 下载"
          className="t-tx grid h-8 w-8 place-items-center rounded-control bg-black/55 text-white/90 backdrop-blur hover:bg-black/80"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {/* 底部控件层：进度条 + 时间 + 倍速 + 音量 + 全屏 */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-6 transition-opacity duration-200",
          chromeVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <TimelineScrubber
          timeline={timeline}
          globalTime={globalTime}
          currentIndex={activeIndex}
          onSeek={seekTo}
          onDraggingChange={setScrubbing}
          tone="dark"
          // 三处形态（内联 / 右栏 / 全屏）用完全一样的轨道与刻度；
          // 时间不在这里显示，底行统一给一处，避免重复。
          showTime={false}
        />

        <div className="mt-1.5 flex items-center gap-1.5 text-white/90">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "暂停" : "播放"}
            disabled={timeline.readyCount === 0}
            className="grid h-7 w-7 place-items-center rounded transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          {/*
            一律显示**整片全局时间**。
            用户看到的是一条连续的讲解视频，进度条也是按整片铺的；
            再显示"第 3 段 / 共 8 段"会把"这只是技术实现的分片"这件事漏给用户，
            而且换段时数字会跳回去，观感上像倒带。

            ⚠️ 只有"一段都没就绪"是例外：那时进度条整体不可拖（见 TimelineScrubber
            的 noReady），必须在这里说明原因 —— 控件层传的是 `showTime={false}`，
            轨道里那句"正在渲染第一个分镜…"根本渲染不出来，不说的话用户面对的是
            一个没有任何解释、拖了也没反应的进度条。
          */}
          <span className="tnum shrink-0 text-xs">
            {timeline.readyCount === 0
              ? "正在渲染第一个分镜…"
              : `${formatDuration(globalTime)} / ${formatDuration(timeline.total)}`}
          </span>

          {/*
            倍速与音量：**三种形态都给**。
            曾经按 variant 裁掉内联小窗的这两个控件，结果是"同一个播放器，
            嵌在对话里就少几个按钮"—— 用户没理由理解这种差异。形态差异只保留
            "起播是否静音"，控件层完全一致（见组件顶部注释）。
          */}
          {/*
            倍速：**悬停就向上浮出卡片**（不是点击展开）。

            用纯 CSS 的 `group-hover/speed` 而不是 Radix 的点击菜单：
              · 悬停展开本来就是"无模态的临时浮层"，用菜单组件会带进焦点管理、
                Esc 关闭、点击外部关闭那一整套模态语义，反而别扭；
              · 卡片和按钮同属一个 group，鼠标在两者之间移动不会闪断。
            卡片容器带 `pb-2`：那 8px 是按钮与卡片之间的**热区**，
            没有它鼠标往上移的瞬间会离开 group，卡片会闪一下再回来。
          */}
          <div className="group/speed relative ml-auto">
            <button
              type="button"
              aria-label={`播放速度，当前 ${speed} 倍`}
              title="播放速度"
              className="tnum flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-white/10 group-hover/speed:bg-white/10"
            >
              {speed}×
            </button>

            {/*
              卡片**居中于按钮正上方**弹出。
              居中不会超出容器：这个按钮右侧还隔着音量/重播/全屏三个按钮（约 114px），
              而卡片半宽只有 64px（`w-32`），余量足够。
            */}
            <div
              className={cn(
                "pointer-events-none absolute bottom-full left-1/2 z-40 -translate-x-1/2 pb-2",
                "translate-y-1 opacity-0 transition-[opacity,transform] duration-150 ease-out",
                "group-hover/speed:pointer-events-auto group-hover/speed:translate-y-0 group-hover/speed:opacity-100",
              )}
            >
              {/*
                黑色半透明 + 背景模糊，而不是不透明的藏青底。
                压在视频上有"浮在画面之上"的感觉，也不会在画面偏亮时闷出一块蓝。
              */}
              <div className="w-32 overflow-hidden rounded-lg border border-white/10 bg-black/70 p-1 shadow-xl backdrop-blur-md">
                <p className="px-2 py-1 text-xs text-white/50">播放速度</p>
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-2 py-1 text-xs transition-colors hover:bg-white/10",
                      s === speed ? "text-white" : "text-white/75",
                    )}
                  >
                    <span className="tnum">{s}×</span>
                    {s === speed && <Check className="h-3.5 w-3.5 text-accent" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/*
            音量：与倍速同款——**悬停向上浮出卡片**，卡片里是竖向滑块。
            以前是"滑杆在按钮右边横向展开"，会把时间数字往左挤、还会顶到相邻控件；
            竖向卡片既不占横向空间，也是主流播放器的形态。
          */}
          <div className="group/vol relative">
            <button
              type="button"
              onClick={() => {
                setVolumeTouched(true);
                toggleMute();
              }}
              aria-label={muted ? "取消静音" : "静音"}
              title={muted ? "取消静音" : "静音"}
              className="grid h-7 w-7 place-items-center rounded transition-colors hover:bg-white/10 group-hover/vol:bg-white/10"
            >
              {/* 图标随音量档位变化，跟主流播放器一致。
                  写成三元而**不是**「取一个组件变量再渲染」——
                  后者会被 react-hooks/static-components 判为"渲染期创建组件"。 */}
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : volume < 0.5 ? (
                <Volume1 className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>

            <div
              className={cn(
                "pointer-events-none absolute bottom-full left-1/2 z-40 -translate-x-1/2 pb-2",
                "translate-y-1 opacity-0 transition-[opacity,transform] duration-150 ease-out",
                "group-hover/vol:pointer-events-auto group-hover/vol:translate-y-0 group-hover/vol:opacity-100",
              )}
            >
              <div className="flex w-11 flex-col items-center gap-1.5 rounded-lg border border-white/10 bg-black/70 px-2 py-2.5 shadow-xl backdrop-blur-md">
                {/*
                  竖向滑块：`writing-mode: vertical-lr` 让 range 竖起来，
                  `direction: rtl` 把"上"变成大值（否则音量会反着走）。
                  这两条组合是实现"底部为 0"的标准做法，Chrome 111+ / Safari 16.4+ /
                  Firefox 120+ 都支持。
                */}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    setVolumeTouched(true);
                    setVolume(Number(e.target.value));
                  }}
                  aria-label="音量"
                  className="h-24 w-1.5 cursor-pointer appearance-none rounded-full bg-white/25 [direction:rtl] [writing-mode:vertical-lr] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
                <span className="tnum text-xs text-white/60">
                  {Math.round((muted ? 0 : volume) * 100)}
                </span>
              </div>
            </div>
          </div>

          {/* 重播：同样三处都给（"从头再看一遍"在哪都得能点到） */}
          <button
            type="button"
            onClick={replay}
            aria-label="重播"
            title="重播"
            className="grid h-7 w-7 place-items-center rounded transition-colors hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {/*
            全屏：真全屏。
            ⚠️ 这里**不要**在渲染期探测 `document.fullscreenEnabled` 之类的浏览器能力：
            服务端渲染时它必然为 false、客户端为 true，两边 title 不一致就是一条
            hydration mismatch（"server rendered HTML didn't match the client properties"）。
            能力以实际调用结果为准（见 onToggleFullscreen），降级时铺满窗口。
          */}
          <button
            type="button"
            onClick={() => void onToggleFullscreen()}
            aria-label={fullscreen || expanded ? "退出全屏" : "全屏"}
            title={fullscreen || expanded ? "退出全屏" : "全屏"}
            className="grid h-7 w-7 place-items-center rounded transition-colors hover:bg-white/10"
          >
            {fullscreen || expanded ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* 条件挂载：关闭即销毁，"已复制"状态和链接自然重置，不需要额外 effect */}
      {shareOpen && (
        <ShareDialog onClose={() => setShareOpen(false)} title={title} finalUrl={finalUrl} />
      )}
    </div>
  );
}
