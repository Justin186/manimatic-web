/**
 * 正在进行的流式请求登记处。
 *
 * ==============================================================================
 * 为什么放在**模块级**，而不是组件里的 ref
 * ==============================================================================
 * 从"新会话"（`/app`）发出第一条消息后会跳到 `/app/t/<id>` —— 那是**另一个 page
 * 组件**，Workbench 会被卸载再重挂载。如果 `AbortController` 留在组件里，跳转的
 * 那一瞬间"停止"按钮就失效了：**流本身是 JS 的 promise，不会因为组件卸载而停止**，
 * 它还会继续跑、继续往 store 里写。所以中止能力必须跟着它待在组件外面。
 *
 * ==============================================================================
 * "是否正在生成"**不在这里**
 * ==============================================================================
 * 那件事的唯一真相来源是消息自己：助手消息的 `streaming`，或者渲染的
 * `render.status === "running"`。派生出它不需要额外状态，也就不会出现
 * "状态说在跑、其实已经停了"这类不同步 —— 所以这里只管中止。
 */

const aborts = new Map<string, AbortController>();

/** 登记一条流。同一会话已有流在跑时，先把旧的停掉 —— 两条流写同一条会话必然错乱。 */
export function registerStream(threadId: string, ctrl: AbortController) {
  aborts.get(threadId)?.abort();
  aborts.set(threadId, ctrl);
}

/** 流正常结束（成功/失败/被中止）时注销。只在自己还是当前那条时才删。 */
export function unregisterStream(threadId: string, ctrl: AbortController) {
  if (aborts.get(threadId) === ctrl) aborts.delete(threadId);
}

/** 用户点了"停止"。没在跑就什么都不做。 */
export function abortStream(threadId: string) {
  aborts.get(threadId)?.abort();
  aborts.delete(threadId);
}
