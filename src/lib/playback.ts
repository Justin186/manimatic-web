"use client";

/*
 * 本文件对以下三条规则做**文件级**抑制，理由如下（不是"为了过 lint"）：
 *
 * 1. react-hooks/immutability
 *    规则原文是"Modifying a value returned from useState()"，它区分不了
 *    「React 状态值」和「存在 state 里的 DOM 元素」。`<video>` 是一个**外部可变对象**，
 *    改它的 volume / muted / playbackRate / src 正是这个 effect 存在的意义 ——
 *    同一条规则的文档里也写明 effect 的用途包含 "manually updating the DOM"。
 *    这是该规则的已知误报类型。
 *    （要"消掉"它得把元素从 useState 挪进 useRef，但那会牵动本 hook 最核心的
 *    进度读数逻辑，属于为 lint 好看去盲改播放器内核，风险不对等。）
 *
 * 2. react-hooks/set-state-in-effect
 *    两处都是必要的命令式同步，规则给的"改成派生值"建议在这里不成立：
 *      · 首个可播分镜出现时自动选中播放头（没有可派生的 prop）
 *      · 切段后踢一次重渲染，让进度读数归位 —— `video.currentTime` 不是响应式的，
 *        读它不会触发渲染。曾试过改成监听 `loadedmetadata` 事件再同步，
 *        但那个事件是异步的，进度条会在切段后停在上一段的位置上百毫秒，肉眼可见。
 *    代价只是每次多一次渲染（挂载、切段各一次），在播放循环里可忽略。
 *
 * 3. react-hooks/refs
 *    进度读数要在渲染期读 `pendingSeekRef`（"待应用的跨段 seek 落点"）。
 *    规则担心的是"ref 变了却不触发重渲染，于是读到过期值"——
 *    这里不成立：该 ref 的每一次写入都伴随 `setActiveIndex` 或 `bump()`，
 *    必定引起重渲染，所以渲染期读到的永远是最新值。
 *    它也不能改成 state：读出与清空的时机由装载 effect 精确控制，
 *    走 state 会引入"effect 里 setState → 多一轮渲染"的时序裂缝，
 *    反而容易让进度条在两帧之间取到错误的值。
 */
/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect, react-hooks/refs */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildTimeline,
  findSlot,
  firstPlayableSlot,
  locate,
  nearestReadyTime,
  nextPlayableSlot,
  type Timeline,
} from "./timeline";
import type { SceneRender } from "./types";

/** 双缓冲的两路。同一时刻只有一路在播、另一路预载下一段 */
type Side = "a" | "b";

const OTHER: Record<Side, Side> = { a: "b", b: "a" };

/** 元素上标记"当前装的是哪一段"，形如 `2:https://.../s2.mp4` */
function slotKey(index: number, url: string) {
  return `${index}:${url}`;
}

/**
 * 取出并清空"属于 `index` 这一段的待应用 seek 目标"。
 *
 * 返回 `null` 表示没有属于这一段的目标（返回 `0` 是有意义的：要回到段首）。
 * 不属于这一段时**不动**它 —— 待应用的目标可能在等另一段装载完成，提前清掉会丢落点。
 * 写成模块级函数是为了不被 effect 的依赖收集器盯上。
 */
function takePendingSeek(
  ref: { current: { index: number; local: number } | null },
  index: number,
): number | null {
  const pending = ref.current;
  if (!pending || pending.index !== index) return null;
  ref.current = null;
  return pending.local;
}

/**
 * 把用户的播放参数写进元素。
 *
 * ⚠️ 必须在**每次 `load()` 之后**重新写一遍：按规范的媒体加载算法，
 * `load()` 会把 `volume` 重置为 1、`playbackRate` 重置回 `defaultPlaybackRate`。
 * 这正是"开了倍速，过了一个分镜交界线又变回 1×"的成因。
 * 顺带设 `defaultPlaybackRate` —— 它才是 `load()` 之后 `playbackRate` 的落点。
 */
function applyPrefs(
  el: HTMLVideoElement,
  prefs: { volume: number; muted: boolean; speed: number },
) {
  el.volume = prefs.volume;
  el.muted = prefs.muted;
  el.defaultPlaybackRate = prefs.speed;
  el.playbackRate = prefs.speed;
}

export type TimelinePlayerApi = {
  /** 两个 `<video>` 各自的 ref 回调（双缓冲：一个可见在播，另一个预载下一段） */
  bindA: (el: HTMLVideoElement | null) => void;
  bindB: (el: HTMLVideoElement | null) => void;
  /** 当前该显示哪一路 —— 组件据此切换两个 video 的可见性 */
  activeSide: Side;
  timeline: Timeline;
  /** 播放头所在的分镜序号；null 表示这条消息还没有任何可分镜 */
  activeIndex: number | null;
  playing: boolean;
  /** 整片全局进度（秒），= 槽位起点 + 段内时间。播放中逐帧刷新（rAF） */
  globalTime: number;
  /** 正在等第几段渲染完成（1-based），不等待时为 null */
  waitingFor: number | null;
  /** 卡在渲染失败的分镜上（1-based），否则 null */
  failedAt: number | null;
  /** 音量（0–1）与静音态 */
  volume: number;
  muted: boolean;
  /** 播放倍速 */
  speed: number;
  seekTo: (globalTime: number) => void;
  seekToScene: (index: number) => void;
  toggle: () => void;
  replay: () => void;
  setVolume: (v: number) => void;
  setSpeed: (v: number) => void;
  toggleMute: () => void;
  /** 取消静音（进全屏时用：内联静音起播，放大后应当能听见声音） */
  unmute: () => void;
};

/**
 * 把 N 个独立的分镜 mp4 表现为「一条整片」。
 *
 * 两条正交的机制：
 *
 * 1. **虚拟时间轴**：物理上是分段的，UI 上是一条连续视频。
 *    全局时间 = `slot.start + 段内时间`，时间轴按分镜顺序铺设，
 *    某格从 pending 亮成 ready 不会移动任何一格。
 *
 * 2. **双缓冲（A/B 两路 `<video>` 交替）**：这是"切段不黑屏"的关键。
 *    单元素方案必然闪 —— 换源要调 `load()`，而按规范媒体加载算法它会**立即清空当前画面**，
 *    随后才去取新数据、重建解码器，这段时间就是用户看到的黑帧。
 *    所以这里常备两路：一路在播，另一路提前把**下一段**载好（`preload="auto"`、静音）。
 *    切段时不去碰正在播的元素，而是把画面切到已经就绪的那一路 ——
 *    整个过程没有 `load()` 打在正在看的元素上，因此没有黑帧。
 *
 *    退化路径：如果目标不是"下一段"（用户拖拽跳段），备用路里装的不是它，
 *    就只能在当前活跃元素上换源 —— 行为等同旧版，会有一次黑帧，但这是不可避免的。
 *
 * 与后端契约的对应（docs/分镜实时交付-契约与前端改造.md §2）：
 *   - `tool_result.durationSec` 是**真实帧时长**（= sections/index.json 的 duration），
 *     不是大纲估算值 —— 分镜定位和进度条精确度都靠它；
 *   - 片段**严格按 1→N 顺序到达**（后端单进程串行 + 边渲边切），
 *     所以不需要"乱序重排"的缓冲编排器：谁到了就点亮谁。
 *     这也让"下一段"总是明确的，双缓冲的预载目标因此很好确定。
 *
 * 三个展示位（对话流内联卡片 / 右栏详情 / 全屏）各自持有一个实例，互不干扰。
 * 进度只在本组件内 setState，**绝不写进 Zustand** —— 否则整列消息会跟着重渲染。
 */
export function useTimelinePlayer(
  scenes: SceneRender[],
  resetKey?: string,
  /**
   * 起播是否静音。
   *
   * 内联卡片/右栏必须静音才能被浏览器允许自动播放（autoplay 策略），全屏可以带声音。
   * 这里显式收成一个入参，而不是让调用方各自去写 `videoEl.muted` ——
   * 两处都写会互相覆盖（换段时 hook 写一次、调用方 effect 又写一次，谁后跑谁赢）。
   */
  options?: { defaultMuted?: boolean },
): TimelinePlayerApi {
  const defaultMuted = options?.defaultMuted ?? true;
  const timeline = useMemo(() => buildTimeline(scenes), [scenes]);

  /** 两路元素。用 state 是为了"元素挂载完成"能触发重渲染，effect 才有得可跑 */
  const [deck, setDeck] = useState<{ a: HTMLVideoElement | null; b: HTMLVideoElement | null }>({
    a: null,
    b: null,
  });
  const deckRef = useRef(deck);
  const [activeSide, setActiveSide] = useState<Side>("a");

  /** 事件处理器里要"同步地"知道哪一路是活跃的，不能等 state 传播 */
  const activeSideRef = useRef<Side>("a");
  const activeElRef = useRef<HTMLVideoElement | null>(null);
  /**
   * 待应用的跨段 seek 目标。带上目标段号，是因为它有两个用途：
   *   1. 装载 effect 里把元素拨到这个段内位置
   *   2. **进度读数在装载完成前的回退值** —— 否则跳段时会先显示"目标段起点"、
   *      下一帧才跳到真正的落点，肉眼就是"进度条先闪到分段的开头"
   */
  const pendingSeekRef = useRef<{ index: number; local: number } | null>(null);
  /**
   * "换源窗口"标记。
   * `load()` 会把 paused 置回 true 并派发 `pause` —— 那是副作用不是用户意图，
   * 若不吞掉，UI 会在切换瞬间以为"被暂停了"而冒出中央播放键。
   */
  const switchingRef = useRef(false);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(defaultMuted);
  const [speed, setSpeedState] = useState(1);
  /**
   * 进度重渲染计数器。
   *
   * `video.currentTime` 是个**非响应式**的可变属性，只有某个 state 变化引起重渲染时
   * 才会被重新读到。以前唯一触发重渲染的是原生 `timeupdate`，而规范只要求它
   * "每 15ms~250ms"发一次、浏览器普遍按 ~4Hz 发 —— 于是进度条每 250ms 跳一格。
   * 现在播放中用 rAF 每帧踢一次（约 60fps），切段/seek 时立即踢一次。
   */
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => (n + 1) % 1_000_000), []);

  const activeEl = deck[activeSide];

  /* ---------------- 元素挂载 ---------------- */

  const bindA = useCallback((el: HTMLVideoElement | null) => {
    setDeck((d) => (d.a === el ? d : { ...d, a: el }));
  }, []);
  const bindB = useCallback((el: HTMLVideoElement | null) => {
    setDeck((d) => (d.b === el ? d : { ...d, b: el }));
  }, []);

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  useEffect(() => {
    activeSideRef.current = activeSide;
    activeElRef.current = deck[activeSide];
  }, [activeSide, deck]);

  const activeSlot = useMemo(
    () => (activeIndex === null ? null : findSlot(timeline, activeIndex)),
    [timeline, activeIndex],
  );

  /** 把正在播的一路上给"当前应该显示哪一路"的样式切换 —— ref 先同步，state 后传播 */
  const promote = useCallback((side: Side) => {
    const el = deckRef.current[side];
    if (!el) return;
    activeSideRef.current = side;
    activeElRef.current = el;
    setActiveSide(side);
  }, []);

  /* ---------------- 播放头初始化 / 重置 ---------------- */

  /* 首次进入：选中第一个可播（或可等）的格子 */
  useEffect(() => {
    if (activeIndex !== null) return;
    const first = firstPlayableSlot(timeline);
    if (first) setActiveIndex(first.index);
  }, [timeline, activeIndex]);

  /* 切换消息/产物：回到开头，避免沿用上一条的播放进度 */
  const lastResetRef = useRef(resetKey);
  useEffect(() => {
    if (lastResetRef.current === resetKey) return;
    lastResetRef.current = resetKey;
    const first = firstPlayableSlot(timeline);
    pendingSeekRef.current = first ? { index: first.index, local: 0 } : null;
    setActiveIndex(first ? first.index : null);
  }, [resetKey, timeline]);

  /* ---------------- 播放状态：订阅两路元素的事件 ---------------- */

  useEffect(() => {
    const els = [deck.a, deck.b].filter((el): el is HTMLVideoElement => el !== null);
    if (els.length === 0) return;

    // 只认活跃那一路的事件：另一路在预载/停住，它的 play/pause 与我们无关
    const fromActive = (e: Event) => e.currentTarget === activeElRef.current;

    const onPlay = (e: Event) => {
      if (!fromActive(e)) return;
      switchingRef.current = false;
      setPlaying(true);
    };
    const onPause = (e: Event) => {
      if (!fromActive(e)) return;
      if (switchingRef.current) return; // 换源窗口内的 pause 不是用户意图
      /*
       * ⚠️ 必须排掉"播到结尾"这种情况。
       * 按规范，媒体播完时 `paused` 会变回 true 并**先派发 `pause`、再派发 `ended`**。
       * 也就是换段必然经过一次 pause，而它发生在"决定换路"之前 ——
       * switchingRef 那时还没置位，抑制不住。若照直 setPlaying(false)，
       * 交界处控件层与中央按钮就会闪一下（用户看到的就是"短暂出现按钮又消失"）。
       * `el.ended` 正好能区分这两种暂停。
       */
      const el = e.currentTarget as HTMLVideoElement;
      if (el.ended) return;
      setPlaying(false);
    };
    const onEnded = (e: Event) => {
      if (!fromActive(e)) return;
      if (activeIndex === null) return;
      const next = nextPlayableSlot(timeline, activeIndex);
      if (!next) {
        setPlaying(false);
        return;
      }
      pendingSeekRef.current = { index: next.index, local: 0 };
      setActiveIndex(next.index);
    };

    els.forEach((el) => {
      el.addEventListener("play", onPlay);
      el.addEventListener("pause", onPause);
      el.addEventListener("ended", onEnded);
    });
    return () => {
      els.forEach((el) => {
        el.removeEventListener("play", onPlay);
        el.removeEventListener("pause", onPause);
        el.removeEventListener("ended", onEnded);
      });
    };
  }, [deck, timeline, activeIndex]);

  /* ---------------- 播放中逐帧推进进度 ---------------- */

  useEffect(() => {
    if (!activeEl || !playing) return;
    let raf = 0;
    const step = () => {
      bump();
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [activeEl, playing, bump]);

  /* ---------------- 装载当前格子 ---------------- */

  useEffect(() => {
    if (!activeEl || !activeSlot) return;

    // 每次重跑都把用户的播放参数重新写一遍（换源那条路径之后还会再补一次）
    applyPrefs(activeEl, { volume, muted, speed });

    const targetKey =
      activeSlot.state === "ready" && activeSlot.url
        ? slotKey(activeSlot.index, activeSlot.url)
        : null;

    // ① 目标不可播（还在渲染 / 失败）→ 清空活跃元素，进入等待态
    if (!targetKey) {
      if (activeEl.dataset.key !== "none") {
        activeEl.dataset.key = "none";
        activeEl.removeAttribute("src");
        activeEl.load();
      }
      return;
    }

    // ② 活跃元素装的就是目标 → 保持播放，只补一次待做的 seek，不打断
    if (activeEl.dataset.key === targetKey) {
      const local = takePendingSeek(pendingSeekRef, activeSlot.index);
      if (local !== null && activeEl.currentTime !== local) {
        activeEl.currentTime = local;
        bump();
      }
      return;
    }

    const standby = deck[OTHER[activeSide]];

    // ③ 备用元素已预载了目标 → **换路**，全程不碰正在播的元素，因此没有黑帧
    if (standby && standby.dataset.key === targetKey) {
      switchingRef.current = true;
      const local = takePendingSeek(pendingSeekRef, activeSlot.index);

      // 上屏前补齐播放参数：它在预载期被强制静音，而且预载时的 `load()`
      // 已经把 volume / playbackRate 打回了默认值
      applyPrefs(standby, { volume, muted, speed });
      if (local !== null && standby.currentTime !== local) standby.currentTime = local;

      const side = OTHER[activeSide];
      promote(side);
      bump();

      // 旧的这一路停下。它的 pause 事件会被"只认活跃元素"的过滤挡掉，不影响 UI
      activeEl.pause();
      void standby.play().catch(() => {
        switchingRef.current = false;
        setPlaying(false);
      });
      return;
    }

    // ④ 都没装目标（跳段 / 首次）→ 只能在活跃元素上换源，退化为单元素路径
    switchingRef.current = true;
    activeEl.dataset.key = targetKey;
    activeEl.src = activeSlot.url as string;
    activeEl.load();
    // 这次 load() 又把刚写好的参数打回了默认，必须再补一次
    applyPrefs(activeEl, { volume, muted, speed });
    bump();

    /*
     * 这里**不能**像 ②③ 那样立刻清掉待应用目标。
     * 换源后 `currentTime` 由 `load()` 归 0，而真正的落点要等 `startPlayback`
     * （可能是 `loadedmetadata` 之后）才写进去 —— 中间那几帧 `belongs` 已是 true
     * 但 `currentTime` 还是 0，清早了进度条就会先闪到段起点。
     * 所以留着它顶着，等 seek 真正落下去再清。
     */
    const pending = pendingSeekRef.current;
    const local = pending && pending.index === activeSlot.index ? pending.local : null;

    const startPlayback = () => {
      if (local !== null && activeEl.currentTime !== local) activeEl.currentTime = local;
      // seek 已应用，待应用目标完成使命（比对引用，别误清后来新设的目标）
      if (pendingSeekRef.current === pending) pendingSeekRef.current = null;
      // 设完当前时间再同步一次读数，
      // 否则暂停状态下跨段 seek 会停在段起点而不是目标位置
      bump();
      // autoplay 可能被浏览器策略拒绝（未静音时），失败就交给用户手动点
      void activeEl.play().catch(() => {
        // 被拒播：退出换源窗口并如实标为暂停 —— 否则 UI 会停在"播放中"但画面不动
        switchingRef.current = false;
        setPlaying(false);
        // 播放没起来，别让待应用目标一直压着进度条
        if (pendingSeekRef.current === pending) pendingSeekRef.current = null;
        bump();
      });
    };
    if (activeEl.readyState >= 1) startPlayback();
    else activeEl.addEventListener("loadedmetadata", startPlayback, { once: true });
  }, [activeEl, deck, activeSide, activeSlot, volume, muted, speed, promote, bump]);

  /* ---------------- 预载下一段到备用元素 ---------------- */

  useEffect(() => {
    /*
     * ⚠️ 备用路必须用 **`activeSideRef`（同步）** 来判断，不能用 `activeSide`（state）。
     *
     * 换路是在装载 effect 里调 `promote()` 完成的，它同步更新了 ref，但 state 要等下一轮
     * 渲染才生效。于是"播完 → 换路"的那一轮里，`activeSide` 还是旧值，按它算出的
     * `standbyEl` 其实是**刚接手播放的那一路** —— 接着对它 `load()` 下一段，
     * 正在播的元素被换源：画面中断、`playbackRate` 被打回 1×（load 的重置行为）。
     * 症状就是"过了分镜交界线，倍速自己变回 1×"。
     *
     * 依赖里保留 `activeSide` 是为了换路后能再跑一次（给新的备用路预载下下段），
     * 但取元素一律走 ref。
     */
    const standby = deckRef.current[OTHER[activeSideRef.current]];
    // 双保险：备用路绝不能是当前正在播的那一路。真出现说明"活跃路"的判断错了，
    // 此时宁可什么都不做（少预载一次），也绝不能把正在播的元素 load() 掉。
    if (!standby || standby === activeElRef.current || activeIndex === null) return;
    const next = nextPlayableSlot(timeline, activeIndex);
    if (!next || next.state !== "ready" || !next.url) return;

    const key = slotKey(next.index, next.url);
    if (standby.dataset.key === key) return;

    /*
     * 预载。要点：
     *   - 强制静音 —— 备用路绝不能出声（否则会与正在播的那一路叠加）
     *   - `preload="auto"` 要在 `load()` 之前设，否则浏览器仍按 metadata 偷懒
     *   - 不发 `play()`，所以它不会触发 play/pause 事件去干扰播放状态
     *   - `load()` 会把播放参数重置，所以预载完把倍速写回去（切上屏时还会再写一次）
     */
    standby.muted = true;
    standby.preload = "auto";
    standby.dataset.key = key;
    standby.src = next.url;
    standby.load();
    standby.defaultPlaybackRate = speed;
    standby.playbackRate = speed;
  }, [deck, activeSide, timeline, activeIndex, speed]);

  /* ---------------- 命令式操作（都作用于当前活跃元素） ---------------- */

  const seekTo = useCallback(
    (globalTime: number) => {
      if (timeline.slots.length === 0) return;
      const hit = locate(timeline, nearestReadyTime(timeline, globalTime));
      if (!hit || hit.slot.state !== "ready" || !hit.slot.url) return;

      const el = activeElRef.current;
      if (el && el.dataset.key === slotKey(hit.slot.index, hit.slot.url)) {
        el.currentTime = hit.localTime;
        // seek 落在同一段上：立即同步进度，否则进度条会停在旧位置直到下一个事件
        bump();
        void el.play().catch(() => undefined);
        return;
      }
      // 跨段：记下"目标段 + 落点"。它同时是装载前那一帧的读数回退值，
      // 否则进度条会先跳到目标段的开头、下一帧才挪到真正的落点（肉眼可见的一闪）
      pendingSeekRef.current = { index: hit.slot.index, local: hit.localTime };
      setActiveIndex(hit.slot.index);
    },
    [timeline, bump],
  );

  const seekToScene = useCallback(
    (index: number) => {
      const slot = findSlot(timeline, index);
      if (!slot || slot.state !== "ready") return;
      seekTo(slot.start);
    },
    [timeline, seekTo],
  );

  const toggle = useCallback(() => {
    const el = activeElRef.current;
    if (!el) return;
    // 用户主动操作：立刻结束换源窗口，别让随后的 pause 事件被当成副作用吞掉
    switchingRef.current = false;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  }, []);

  const replay = useCallback(() => {
    const first = firstPlayableSlot(timeline);
    if (!first) return;
    const el = activeElRef.current;
    pendingSeekRef.current = { index: first.index, local: 0 };
    setActiveIndex(first.index);
    if (el && el.dataset.key === slotKey(first.index, first.url ?? "")) {
      el.currentTime = 0;
      bump();
      void el.play().catch(() => undefined);
    }
  }, [timeline, bump]);

  const setVolume = useCallback((v: number) => {
    const next = Math.min(Math.max(v, 0), 1);
    setVolumeState(next);
    // 拖到 0 视为静音；从 0 往上拉自动解除静音
    setMuted(next === 0);
    const el = activeElRef.current;
    if (el) {
      el.volume = next;
      el.muted = next === 0;
    }
  }, []);

  const setSpeed = useCallback((v: number) => {
    setSpeedState(v);
    const el = activeElRef.current;
    if (el) el.playbackRate = v;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      const el = activeElRef.current;
      if (el) el.muted = next;
      return next;
    });
  }, []);

  const unmute = useCallback(() => {
    setMuted(false);
    const el = activeElRef.current;
    if (el) el.muted = false;
  }, []);

  /* ---------------- 进度读数 ---------------- */

  /*
   * 只有**全局时间**这一个读数：用户看到的是一条连续视频，进度条与时间数字都按整片算。
   * "当前是第几段"属于实现细节（分片是后端为了边渲边交付才切的），不该漏到 UI 上。
   *
   * 取值优先级（顺序不能变）：
   *   ① 有"属于这一段"的待应用 seek 目标 → 用它。
   *      它代表**用户期望的位置**：跨段跳转时元素还没换/还没 seek 完，
   *      此时若回退到段起点，进度条会先闪到该分段的开头、下一帧才挪到落点。
   *      这个值在 seek 真正落到元素上之后由装载 effect 清掉。
   *   ② 活跃元素装的**就是**这一段 → 直接读 `currentTime`（正常播放）。
   *      必须校验这一点：切段那一帧 `activeSlot` 已是新段，元素里还是上一段，
   *      `currentTime` 是旧段末尾值 —— 直接算会被 `min(旧末尾, 新段时长)` 截断，
   *      进度条先跳末尾再弹回起点。
   *   ③ 其余 → 段起点（等这一段的源）。
   */
  const globalTime = useMemo(() => {
    void tick; // 依赖 tick：每帧/每次显式同步都重新读取

    if (!activeSlot) return 0;
    // 还没就绪（还在渲染）时没有源：停在等待位置，不显示假进度
    if (!activeSlot.url) return activeSlot.start;

    const pending = pendingSeekRef.current;
    const belongs = activeEl ? activeEl.dataset.key === slotKey(activeSlot.index, activeSlot.url) : false;

    let raw = 0;
    if (pending && pending.index === activeSlot.index) {
      raw = pending.local;
    } else if (belongs && activeEl) {
      raw = activeEl.currentTime;
    }

    const local = Math.min(Math.max(raw, 0), activeSlot.duration);
    return activeSlot.start + local;
  }, [activeSlot, activeEl, tick]);

  return {
    bindA,
    bindB,
    activeSide,
    timeline,
    activeIndex,
    playing,
    globalTime,
    waitingFor: activeSlot?.state === "pending" ? activeSlot.index + 1 : null,
    failedAt: activeSlot?.state === "failed" ? activeSlot.index + 1 : null,
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
  };
}
