/**
 * 真全屏。
 *
 * 为什么不用现有的 `VideoStage`（Dialog）当"全屏"：那只是个居中的详情弹窗，
 * 浏览器 UI、地址栏、侧边栏都还在，用户明确说过"不要那种详情，就是点击后确实是全屏"。
 * 这里走标准的 Fullscreen API。
 *
 * ⚠️ 全屏的对象**必须是容器**（video + 控件层），不能是裸 `<video>` 元素 ——
 * 浏览器全屏时只渲染被指定的那棵子树，对 video 调 requestFullscreen 会把
 * 兄弟节点里的控件层（进度条、倍速、分享…）一起丢掉。
 */

/*
 * 注意：这里**故意不提供** `fullscreenSupported()` 这种能力探测函数。
 * 它只能在渲染期调用，而服务端渲染时 `document` 不存在、客户端却能读到真值 ——
 * 两边算出的结果不同就是一条 hydration mismatch（实测踩过：
 * 「title 属性在服务端是降级文案、客户端是'全屏'」）。
 * 能力判断改成以 `toggleFullscreen()` 的实际返回值为准，见下。
 */

/** 某个元素当前是否处于全屏 */
export function isFullscreenElement(el: Element | null): boolean {
  if (!el || typeof document === "undefined") return false;
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return (d.fullscreenElement ?? d.webkitFullscreenElement ?? null) === el;
}

/**
 * 进入/退出全屏。返回是否真的切换成功 —— 失败时调用方可降级到 Dialog，
 * 不要让"点全屏没反应"变成又一个静默失败。
 */
export async function toggleFullscreen(el: HTMLElement | null): Promise<boolean> {
  if (!el || typeof document === "undefined") return false;
  const target = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };

  try {
    if (isFullscreenElement(el)) {
      await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    } else {
      await (el.requestFullscreen?.() ?? target.webkitRequestFullscreen?.());
    }
    return true;
  } catch {
    // 浏览器策略拒绝（如非用户手势、iframe 未授权）——由调用方决定降级方案
    return false;
  }
}
