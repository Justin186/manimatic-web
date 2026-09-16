"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import {
  confirmRender,
  deleteThread as deleteThreadApi,
  fetchThreadDetail,
  fetchThreads,
  mediaUrl,
  patchThread,
  replaceScene,
  retryScene,
  setThreadShare,
  streamChat,
  USE_MOCK,
} from "@/lib/api";
import { useStore } from "@/lib/store";
import { abortStream, registerStream, unregisterStream } from "@/lib/streams";
import { useLocalStorage, useMediaQuery } from "@/lib/use-ui";
import { cn, uid } from "@/lib/utils";
import type { Message, PlanStep, RenderState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, SheetContent } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

import { ArtifactPanel, type Artifact } from "./ArtifactPanel";
import { ChatStream } from "./ChatStream";
import { Composer } from "./Composer";
import { ThreadSidebar } from "./ThreadSidebar";
import { TopBar } from "./TopBar";

const EMPTY: Message[] = [];

/**
 * 工作台。
 *
 * ==============================================================================
 * 两种形态，区别只在于有没有 threadId
 * ==============================================================================
 * - `threadId` 有值（`/app/t/<id>`）：照常打开一条会话。
 * - `threadId` 为空（`/app`）：**草稿模式** —— 界面是空对话 + 居中输入框，
 *   URL 就停在 `/app`，不生成 id、不登记侧栏。
 *
 * 草稿模式的 id 是**发出第一条消息那一刻**才生成的（见 `send`）。这样"新建对话"
 * 这个动作本身不产生任何记录：用户点了一下、一个字没说就切走，侧栏里不会多出
 * 一条空会话，也无所谓"要不要清理它"。
 */
export function Workbench({ threadId }: { threadId?: string }) {
  const router = useRouter();

  const threads = useStore((s) => s.threads);
  const messages = useStore((s) => (threadId ? s.messages[threadId] : undefined) ?? EMPTY);
  const profile = useStore((s) => s.profile);
  const style = useStore((s) => s.style);

  const appendMessage = useStore((s) => s.appendMessage);
  const patchMessage = useStore((s) => s.patchMessage);
  const patchRender = useStore((s) => s.patchRender);
  const patchScene = useStore((s) => s.patchScene);
  const setActive = useStore((s) => s.setActive);
  const ensureThread = useStore((s) => s.ensureThread);
  const hydrateThreads = useStore((s) => s.hydrateThreads);
  const hydrateMessages = useStore((s) => s.hydrateMessages);
  const patchThreadLocal = useStore((s) => s.patchThreadLocal);
  const removeThreadsLocal = useStore((s) => s.removeThreadsLocal);

  const [retrying, setRetrying] = useState<number | null>(null);
  /** 会话在后端的保留天数（/api/threads 带回来的）。0 = 后端不清理 */
  const [ttlDays, setTtlDays] = useState(0);
  /** 待确认删除的会话 id（null = 没在确认）。确认框归这里管，侧栏只负责发起 */
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  /** 分享链接弹窗的内容；null = 关着 */
  const [shareInfo, setShareInfo] = useState<{ id: string; url: string } | null>(null);
  /**
   * 轻提示。
   *
   * 原来是本地 `note` 状态 + 一小块手写的固定浮层：只能显示一条、位置写死在组件里、
   * 每条提示的生命周期得自己在每个调用点管。现在换成全局 Toast ——
   * 多条可以叠、定时器由 Provider 统一回收，这里只剩"说一句"这件事。
   * Provider 挂在根布局上，所以落地页、设置页将来也能直接用。
   */
  const toast = useToast();

  /** 右栏当前打开的产物详情；null = 停在列表 */
  const [artifactOpenId, setArtifactOpenId] = useState<string | null>(null);
  const [reviseTarget, setReviseTarget] = useState<{ messageId: string; index: number } | null>(null);
  const [reviseText, setReviseText] = useState("");

  // 收起状态持久化（架构文档 §4 硬性约束 2）。存 null 表示"用户没手动改过"：
  // 这时按屏幕宽度自动决定 —— 手机上默认收起，避免一进页面就被抽屉糊住。
  const [navPref, setNavPref] = useLocalStorage<boolean | null>("nav.open", null);
  const [previewPref, setPreviewPref] = useLocalStorage<boolean | null>("preview.open", null);

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const isWide = useMediaQuery("(min-width: 1024px)");
  const navOpen = navPref ?? isDesktop;
  const previewOpen = previewPref ?? isWide;

  const autoRetried = useRef<Set<string>>(new Set());
  /** 已水合过的会话 id：切回来时不再重拉，本地那份可能更新（比如正在渲染） */
  const hydrated = useRef<Set<string>>(new Set());

  /**
   * 是否正在生成。**从消息自己派生出来，不另设一份状态**。
   *
   * 这样做的实际好处：从草稿模式发出第一条消息会跳到 `/app/t/<id>`，
   * Workbench 随之被卸载重挂载 —— 派生值在新组件里立刻就是对的，
   * 而存在组件里的 `busy` 会归零，表现为"生成中却又能再点一次发送"。
   * 中止控制器同理放在模块级（见 lib/streams.ts）。
   */
  const busy = messages.some((m) => m.streaming || m.render?.status === "running");

  useEffect(() => {
    // 草稿模式把 activeId 清空：侧栏此时不该高亮任何一条
    setActive(threadId ?? "");
  }, [threadId, setActive]);

  /* ---------------- 刷新后恢复（后端是唯一事实来源） ----------------
   *
   * 先要列表、再要当前这条会话的消息。两处失败都**静默保持空态** —— 后端没起来时
   * 界面应该是"没有历史记录"，而不是甩一堆红字；侧栏会说明到底是哪种情况。
   */
  useEffect(() => {
    if (USE_MOCK) return;        // Mock 没有会话接口，直接停在空态
    let alive = true;
    void fetchThreads().then(
      (r) => {
        if (!alive) return;
        hydrateThreads(r.threads);
        setTtlDays(r.ttl_days);
      },
      () => {
        /* 后端没起：保持空列表与空态提示 */
      },
    );
    return () => {
      alive = false;
    };
  }, [hydrateThreads]);

  useEffect(() => {
    if (USE_MOCK || !threadId) return;   // 草稿模式没有会话可拉
    if (hydrated.current.has(threadId)) return;
    // 本地已经有这一轮的内容（刚生成完 / 正在生成）→ 后端那份只会更旧，别覆盖。
    // 尤其 streaming 期间：后端要等这一轮流结束才落盘，覆盖等于把正在出的字擦掉。
    if ((useStore.getState().messages[threadId] ?? []).length) return;
    let alive = true;
    void fetchThreadDetail(threadId).then(
      (r) => {
        // ⚠️ 标记必须打在**成功之后**，不能打在请求之前。
        //    StrictMode（next dev 默认开，本项目没关）会把挂载时的 effect 跑两遍：
        //    第一遍发出请求后立刻被 cleanup（alive=false），若之前就打了标记，
        //    第二遍会以为"已经水合过"而直接跳过 —— 两边都不写，会话永远加载不出来。
        //    症状恰好是"侧栏列得出会话、点进去却一个字都没有"；列表那个 effect
        //    没有这层守卫，所以它没事，看起来就像只有详情坏掉了。
        if (!alive) return;
        hydrated.current.add(threadId);
        if (r.messages.length) hydrateMessages(threadId, r.messages);
      },
      () => {
        /* 拉不到就保持现状，也**不打标记** —— 下次还有机会重试。
           新建的空会话本来就该是空的 */
      },
    );
    return () => {
      alive = false;
    };
  }, [threadId, hydrateMessages]);

  /* ---------------- 事件分发 ---------------- */

  function handleEvent(tid: string, messageId: string, name: string, data: unknown) {
    const d = (data ?? {}) as Record<string, unknown>;

    switch (name) {
      case "tool_progress": {
        const step = Number(d.step ?? 0);
        const stage = d.stage as RenderState["stage"];
        patchRender(tid, messageId, {
          step,
          total: Number(d.total ?? 0),
          stage,
        });
        // 串行渲染下 step 就是"已交付段数"，所以正在渲的正是第 `step` 个（0-based）：
        //   step=0      → 第 1 段在渲；step=1 → 第 2 段在渲 … step=total → 没有下一段了
        // 只把 queued 的翻成 rendering，别覆盖已是 done / error 的格子 ——
        // 失败时后端先发 error 再发进度，不加这个判断会把错误状态吞掉。
        if (stage === "rendering") {
          const st = useStore.getState();
          const msg = (st.messages[tid] ?? []).find((m) => m.id === messageId);
          const cur = msg?.render?.scenes[step];
          if (cur?.status === "queued") {
            patchScene(tid, messageId, cur.index, { status: "rendering" });
          }
        }
        break;
      }

      case "tool_result":
        patchScene(tid, messageId, Number(d.index ?? 0), {
          status: "done",
          // 后端给的是 {MSB_PUBLIC_BASE_URL}/media/... 这种绝对地址，默认指向 localhost ——
          // 局域网访问时那指的是别人自己的机器，必须换成同源地址（见 mediaUrl）。
          url: mediaUrl(String(d.url ?? "")),
          durationSec: Number(d.durationSec ?? 0),
        });
        break;

      case "tool_done":
        patchRender(tid, messageId, {
          status: "done",
          finalUrl: mediaUrl(String(d.url ?? "")),
        });
        break;

      case "error": {
        const scope = d.scope as "step" | "task";
        if (scope === "step") {
          const index = Number(d.index ?? 0);
          patchScene(tid, messageId, index, {
            status: "error",
            message: String(d.message ?? "渲染失败"),
          });
          if (d.retryable !== false) autoRetry(tid, messageId, index);
        } else {
          patchMessage(tid, messageId, { error: String(d.message ?? "生成失败") });
          patchRender(tid, messageId, { status: "error" });
        }
        break;
      }

      case "done": {
        const st = useStore.getState();
        const msg = (st.messages[tid] ?? []).find((m) => m.id === messageId);
        const hasError = msg?.render?.scenes.some((s) => s.status === "error") ?? false;
        const hasFinal = Boolean(msg?.render?.finalUrl);
        patchRender(tid, messageId, {
          status: hasError ? "error" : hasFinal ? "done" : "running",
        });
        break;
      }
    }
  }

  async function doRetry(tid: string, messageId: string, index: number) {
    setRetrying(index);
    patchScene(tid, messageId, index, { status: "queued", message: undefined });
    try {
      await retryScene({ thread_id: tid, message_id: messageId, scene_index: index }, (n, d) =>
        handleEvent(tid, messageId, n, d),
      );
    } catch (err) {
      patchScene(tid, messageId, index, {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRetrying(null);
    }
  }

  /** Q12：自动重试 1 次；再失败就交给用户点按钮，绝不整条任务失败 */
  function autoRetry(tid: string, messageId: string, index: number) {
    const key = `${messageId}:${index}`;
    if (autoRetried.current.has(key)) return;
    autoRetried.current.add(key);
    window.setTimeout(() => void doRetry(tid, messageId, index), 900);
  }

  function appendText(tid: string, messageId: string, delta: string) {
    const st = useStore.getState();
    const msg = (st.messages[tid] ?? []).find((m) => m.id === messageId);
    if (!msg) return;
    // 正文开始出字 = 思考阶段结束。放在这里而不是各个事件分支里，
    // 是为了让"思考中"这个状态只有一个熄火点，不会某条路径忘了关。
    patchMessage(tid, messageId, {
      text: msg.text + delta,
      ...(msg.thinkingLive ? { thinkingLive: false } : null),
    });
  }

  /**
   * 累积模型的思考过程。
   *
   * 只在真实后端开了 `MSB_LLM_SHOW_THINKING` 时才会收到 thinking_delta；
   * 收不到时这里永远不会被调用，UI 照常工作（只是没有思考预览）。
   */
  function appendThinking(tid: string, messageId: string, delta: string) {
    const st = useStore.getState();
    const msg = (st.messages[tid] ?? []).find((m) => m.id === messageId);
    if (!msg) return;
    patchMessage(tid, messageId, {
      thinking: (msg.thinking ?? "") + delta,
      thinkingLive: true,
      // 记首次出现的时刻：指示器显示的"已思考 N 秒"要用它，
      // 用 createdAt 会在长会话里算出一个荒唐的大数
      thinkingStartedAt: msg.thinkingStartedAt ?? Date.now(),
    });
  }

  /* ---------------- 侧栏菜单的动作 ----------------
   *
   * 一律**先改本地、失败再还原**：改名和置顶都是"用户按下就该立刻看到结果"的操作，
   * 等一个来回的请求再变，手感会明显发涩。还原那一步不能省 —— 否则请求失败时
   * 界面留着成功的样子，用户下次刷新才发现白改了（本项目最忌讳的静默失效）。
   */
  async function renameRemote(id: string, title: string) {
    const before = threads.find((t) => t.id === id)?.title ?? "";
    patchThreadLocal(id, { title });
    try {
      const r = await patchThread(id, { title });
      if (!r.ok) throw new Error(r.error || "改名失败");
    } catch (err) {
      patchThreadLocal(id, { title: before });
      toast(`改名失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function togglePinRemote(id: string, pinned: boolean) {
    const before = Boolean(threads.find((t) => t.id === id)?.pinned);
    patchThreadLocal(id, { pinned });
    try {
      const r = await patchThread(id, { pinned });
      if (!r.ok) throw new Error(r.error || "置顶失败");
    } catch (err) {
      patchThreadLocal(id, { pinned: before });
      toast(`置顶失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function shareRemote(id: string) {
    try {
      const r = await setThreadShare(id, true);
      if (!r.ok || !r.slug) throw new Error(r.error || "生成分享链接失败");
      // 链接在前端拼：后端只知道自己的地址（那是 media 的前缀），不知道前端端口。
      setShareInfo({ id, url: `${window.location.origin}/share/${r.slug}` });
      patchThreadLocal(id, { shared: true });
    } catch (err) {
      toast(`分享失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function unshareRemote(id: string) {
    try {
      const r = await setThreadShare(id, false);
      if (!r.ok) throw new Error(r.error || "取消分享失败");
      patchThreadLocal(id, { shared: false });
      setShareInfo(null);
      toast("已取消分享，原来的链接立即失效");
    } catch (err) {
      toast(`取消分享失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function doDelete(ids: string[]) {
    setPendingDelete(null);
    // 逐条删：接口一次只认一个 id。会话数量很少，不值得为批量多开一个入口
    // （多一个批量接口就多一处"部分成功"的歧义要处理）。
    const failed: string[] = [];
    for (const id of ids) {
      try {
        const r = await deleteThreadApi(id);
        if (!r.ok) throw new Error(r.error || "删除失败");
      } catch {
        failed.push(id);
      }
    }
    const done = ids.filter((id) => !failed.includes(id));
    if (done.length) {
      removeThreadsLocal(done);
      // 正在看的这条被删掉了 → 回入口，别停在一个已经不存在的会话上
      if (threadId && done.includes(threadId)) router.push("/app");
    }
    toast(
      failed.length
        ? `${failed.length} 条没删掉，稍后重试`
        : `已删除 ${done.length} 条会话及其渲染产物`,
    );
  }

  /* ---------------- 主动作 ---------------- */

  async function send(text: string) {
    if (busy) return;

    // 草稿模式：**这一刻**才生成会话 id。
    //
    // 这是"新建对话不产生空会话"的关键 —— id 一旦生成就意味着这条会话真的存在了。
    // 之前是"点新建就生成 id 并跳转"，于是侧栏立刻多一条「新的讲解」，
    // 用户什么都没说、切走也不会消失，点几次就攒几条。
    const tid = threadId ?? uid("t");
    const firstMessage = !threadId;

    const ctrl = new AbortController();
    registerStream(tid, ctrl);

    // 这两个 id 不只是本地的事：要随请求发给后端落盘。
    // 刷新后前端正是靠 assistant 那个 id 把自己的气泡和后端产出的分镜/视频重新对上。
    const userMsgId = uid("mu");
    appendMessage(tid, { id: userMsgId, role: "user", text, createdAt: Date.now() });
    const asstId = uid("ma");
    appendMessage(tid, {
      id: asstId,
      role: "assistant",
      text: "",
      streaming: true,
      version: 1,
      createdAt: Date.now(),
    });

    // 标题：第一条消息的前 20 字（后端推导标题用的是同一规则）。
    // 这里同时也是"把会话登记进侧栏"的唯一时机。
    const cur = threads.find((t) => t.id === tid);
    if (!cur || cur.title === "新的讲解" || cur.title === "默认会话") {
      ensureThread(tid, text.slice(0, 20));
    }

    // 会话真开始了才改 URL。change 到 /app/t/<id> 会让 Workbench 重挂载，
    // 但没关系：消息在 store 里、中止控制器在模块级、busy 是从消息派生的 ——
    // 三样都不依赖组件实例，所以流会照常跑完。
    if (firstMessage) router.replace(`/app/t/${tid}`);

    try {
      await streamChat(
        {
          thread_id: tid,
          message: text,
          profile,
          overrides: { style },
          message_id: asstId,
          user_message_id: userMsgId,
        },
        (name, data) => {
          const d = (data ?? {}) as Record<string, unknown>;
          if (name === "text_delta") {
            appendText(tid, asstId, String(d.text ?? ""));
          } else if (name === "thinking_delta") {
            appendThinking(tid, asstId, String(d.text ?? ""));
          } else if (name === "plan") {
            const plan = (d.plan ?? []) as PlanStep[];
            const intent = (d.intent ?? "none") as "propose" | "none";
            patchMessage(tid, asstId, {
              plan,
              intent,
              planState: intent === "propose" ? "pending" : "none",
            });
          } else if (name === "done") {
            patchMessage(tid, asstId, { streaming: false, thinkingLive: false });
          } else if (name === "error") {
            patchMessage(tid, asstId, {
              streaming: false,
              thinkingLive: false,
              error: String(d.message ?? "生成失败"),
            });
          }
        },
        ctrl.signal,
      );
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      patchMessage(tid, asstId, {
        streaming: false,
        thinkingLive: false,
        error: aborted ? undefined : err instanceof Error ? err.message : String(err),
      });
    } finally {
      unregisterStream(tid, ctrl);
    }
  }

  async function confirm(messageId: string) {
    const tid = threadId;
    if (!tid) return;
    const st = useStore.getState();
    const msg = (st.messages[tid] ?? []).find((m) => m.id === messageId);
    if (!msg?.plan?.length) return;
    const plan = msg.plan;

    patchMessage(tid, messageId, {
      planState: "confirmed",
      render: {
        status: "running",
        step: 0,
        total: plan.length,
        scenes: plan.map((p, i) => ({
          index: i,
          title: p.title,
          status: "queued",
          durationSec: p.durationSec,
        })),
      },
    });
    try {
      await confirmRender(
        { thread_id: tid, message_id: messageId, plan },
        (n, d) => handleEvent(tid, messageId, n, d),
      );
    } catch (err) {
      patchMessage(tid, messageId, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function regenerate(messageId: string) {
    const tid = threadId;
    if (!tid) return;
    const st = useStore.getState();
    const list = st.messages[tid] ?? [];
    const idx = list.findIndex((m) => m.id === messageId);
    const prevUser = [...list.slice(0, idx)].reverse().find((m) => m.role === "user");
    const question = prevUser?.text;
    if (!question) return;
    // 重新生成要把上一轮的思考一起清掉：不清的话会出现"旧思考 + 新思考"叠在一起，
    // 而且 thinkingStartedAt 还是上一轮的时间，"已思考 N 秒"会直接算飞。
    patchMessage(tid, messageId, {
      text: "",
      plan: undefined,
      planState: undefined,
      streaming: true,
      thinking: undefined,
      thinkingLive: false,
      thinkingStartedAt: undefined,
    });
    try {
      await streamChat(
        {
          thread_id: tid,
          message: question,
          profile,
          overrides: { style },
          // 重新生成复用同一个消息 id：新一轮产物仍然挂在它名下，
          // 刷新后恢复出来还是同一条消息，而不是多出一条空壳。
          message_id: messageId,
          // **用户那条也要带上 id**：不带的话后端就认不出"这句问过了"，
          // 于是又追加一条一模一样的提问 —— 记录里同一句问两遍（模型下一轮也会读到两遍）。
          // 带了 id，后端就把它原地覆盖（见 store.append_thread_message）。
          user_message_id: prevUser?.id,
        },
        (n, d) => {
          const dd = (d ?? {}) as Record<string, unknown>;
          if (n === "text_delta") appendText(tid, messageId, String(dd.text ?? ""));
          else if (n === "thinking_delta") appendThinking(tid, messageId, String(dd.text ?? ""));
          else if (n === "plan") {
            const plan = (dd.plan ?? []) as PlanStep[];
            const intent = (dd.intent ?? "none") as "propose" | "none";
            patchMessage(tid, messageId, {
              plan,
              intent,
              planState: intent === "propose" ? "pending" : "none",
              streaming: false,
              thinkingLive: false,
            });
          } else if (n === "done") {
            patchMessage(tid, messageId, { streaming: false, thinkingLive: false });
          }
        },
      );
    } finally {
      // 流结束后把 streaming 关掉（正常路径由 done 事件负责，这里兜网络异常）
      const now = useStore.getState().messages[tid] ?? [];
      if (now.some((m) => m.id === messageId && m.streaming)) {
        patchMessage(tid, messageId, { streaming: false, thinkingLive: false });
      }
    }
  }

  /** Q16：整分镜替换 —— 每次修正生成一条新消息（v1/v2/v3 并列，保留不同方向的尝试） */
  async function revise(messageId: string, index: number, instruction: string) {
    const tid = threadId;
    if (!tid) return;
    const st = useStore.getState();
    const src = (st.messages[tid] ?? []).find((m) => m.id === messageId);
    if (!src?.render) return;

    const newId = uid("ma");
    appendMessage(tid, {
      id: newId,
      role: "assistant",
      version: (src.version ?? 1) + 1,
      text: `已按「${instruction}」重做第 ${index + 1} 个分镜，其余分镜保持不变。`,
      plan: src.plan,
      planState: "confirmed",
      intent: src.intent,
      render: {
        ...src.render,
        status: "running",
        step: Math.max(0, src.render.scenes.length - 1),
        scenes: src.render.scenes.map((s) =>
          s.index === index ? { ...s, status: "queued", message: undefined } : s,
        ),
      },
      createdAt: Date.now(),
    });

    try {
      await replaceScene(
        {
          thread_id: tid,
          message_id: newId,
          scene_index: index,
          instruction,
          durationSec: src.render.scenes[index]?.durationSec ?? 8,
        },
        (n, d) => handleEvent(tid, newId, n, d),
      );
    } catch (err) {
      patchMessage(tid, newId, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  /* ---------------- 产物：一条会话里的所有成片 ---------------- */

  /**
   * 这条会话产生过的**全部**产物。
   *
   * 为什么不是"当前选中的那一条消息"：每次「AI 改分镜」都会 append 一条新的 assistant
   * 消息（v1/v2/v3 并列），所以一条会话里有多个成片是常态。右栏原来只取最后一条，
   * 用户既看不到这条会话出过几版，也回看不了旧版。
   *
   * 顺序取最新在前（与对话流相反，产物面板里"最近生成"更值得优先看到）。
   */
  const artifacts = useMemo<Artifact[]>(() => {
    const list: Artifact[] = [];
    for (const m of messages) {
      if (m.role !== "assistant" || !m.render) continue;
      list.push({
        messageId: m.id,
        version: m.version ?? 1,
        title: m.plan?.[0]?.title ?? m.text.slice(0, 24) ?? "讲解视频",
        render: m.render,
        createdAt: m.createdAt,
      });
    }
    return list.reverse();
  }, [messages]);

  /** 内联卡片点「详情」：如果右栏收起了就先展开，再定位到该产物 */
  const openArtifact = (messageId: string) => {
    setPreviewPref(true);
    setArtifactOpenId(messageId);
  };

  /* ---------------- 快捷键 ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "\\") {
        e.preventDefault();
        setNavPref(!navOpen);
      }
      if (e.key === "Enter") {
        const pending = messages.find(
          (m) => m.role === "assistant" && m.planState === "pending" && m.plan?.length,
        );
        if (pending) {
          e.preventDefault();
          void confirm(pending.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const title = threadId
    ? (threads.find((t) => t.id === threadId)?.title ?? "新的讲解")
    : "新对话";

  /** 空会话（含草稿）：输入框摆到正中间。抽出来只写一遍，两处布局都用它 */
  const composer = (compact: boolean) => (
    <Composer
      compact={compact}
      busy={busy}
      onSend={send}
      onAbort={() => threadId && abortStream(threadId)}
    />
  );

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <TopBar
        title={title}
        navOpen={navOpen}
        previewOpen={previewOpen}
        // 空会话时右栏不渲染，按钮也一并收起来 —— 留一个点了没反应的按钮更让人困惑
        showPreview={messages.length > 0}
        onToggleNav={() => setNavPref(!navOpen)}
        onTogglePreview={() => setPreviewPref(!previewOpen)}
        onNewThread={() => router.push("/app")}
      />

      <div className="flex min-h-0 flex-1">
        {/*
          左栏：收起 / 展开走**宽度动画**，不再条件渲染（条件渲染没有过渡可言）。

          ⚠️ 关键是"外层裁切 + 内层定宽"，不能直接动侧栏自己的宽度：
          若让侧栏从 288px 过渡到 0，里面的文字会**一路折行重排**，
          看着像被挤压，而不是被收起。
          现在是外层宽度 `0 ↔ 288`（`.t-collapse` 只过渡 width）且 `overflow-hidden`，
          内层恒为 288px —— 内容不动，只是被"拉出来 / 推回去"。

          ⚠️ 分隔线画在**内层**：外层为 0 宽时，内层连同边框一起被裁掉，
          不会在边上留下一条 1px 的孤线（画在外层就会留）。

          ⚠️ 收起时必须加 `inert`：0 宽 + `overflow-hidden` 只是"看不见"，
          里面的按钮仍然在 Tab 焦点路径上 —— 键盘用户会跳进一个看不见的面板。
        */}
        <aside
          className={cn(
            "t-collapse hidden shrink-0 overflow-hidden md:block",
            navOpen ? "w-72" : "w-0",
          )}
          inert={!navOpen}
        >
          <div className="h-full w-72 border-r border-border">
            <ThreadSidebar
              threads={threads}
              activeId={threadId ?? ""}
              onSelect={(id) => router.push(`/app/t/${id}`)}
              onNew={() => router.push("/app")}
              ttlDays={ttlDays}
              onRename={(id, title) => void renameRemote(id, title)}
              onTogglePin={(id, pinned) => void togglePinRemote(id, pinned)}
              onShare={(id) => void shareRemote(id)}
              onDelete={(ids) => setPendingDelete(ids)}
            />
          </div>
        </aside>

        {/* 中栏最小宽度 530px：不按比例无限压缩，否则两侧全展开时对话区会被挤成一条 */}
        <main className="flex min-w-0 flex-1 flex-col md:min-w-[530px]">
          {messages.length === 0 ? (
            /*
             * 空会话（草稿 / 还没说过话的会话）：输入框摆到正中间，像主流的对话界面。
             * 这里**不写引导文案** —— 一屏只有一个输入框，看到就知道该干什么，
             * 再补一段说明文字只是噪音。
             */
            <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-20">
              {/*
                一层极淡的品牌光晕。整页是近白的暖底，一片平色容易显"素"；
                光晕在空屏上给一个视觉落点，但浓度压得很低 ——
                空屏是"等你开口"的地方，背景不该抢戏。
                走 `t-glow` 工具类而不是内联写死颜色：暗色档会自动换成提亮后的光晕，
                内联写死会在暗色下变成一块发亮的脏斑。
              */}
              <div aria-hidden className="t-glow pointer-events-none absolute inset-0" />

              <div className="relative flex flex-col items-center">
                {/* 品牌记号：与顶栏 logo 同一个形状。空屏上它承担"这是哪儿" */}
                <span className="t-grad mb-5 grid h-12 w-12 place-items-center rounded-inner text-accent-fg">
                  <Sparkles className="h-6 w-6" />
                </span>
                {/*
                  一句标题。之前这里什么都不放，整个屏幕只有一个输入框 ——
                  这就是用户说的"感觉很空"。主流产品在同一个位置都有一句问候/定位语
                  （DeepSeek「晚上好，有什么我能帮你的吗？」，豆包「有什么我能帮你的吗？」），
                  它回答的是"我在这儿该做的第一件事是什么"。
                  ⚠️ 只放一句，**不要第二行说明** —— 那正是上一版被用户点名去掉的东西。
                */}
                <h2 className="mb-8 font-display text-3xl text-fg">
                  把知识点讲成一段动画
                </h2>
                <div className="w-full max-w-[53rem]">{composer(true)}</div>
              </div>
            </div>
          ) : (
            <>
              <ChatStream
                messages={messages}
                busy={busy}
                retryingIndex={retrying}
                onPlanChange={(id, plan) => {
                  if (threadId) patchMessage(threadId, id, { plan: plan ?? undefined });
                }}
                onConfirm={confirm}
                onRegenerate={regenerate}
                onRetry={(id, index) => {
                  if (threadId) void doRetry(threadId, id, index);
                }}
                onRevise={(id, index) => setReviseTarget({ messageId: id, index })}
                onOpenArtifact={openArtifact}
              />
              {composer(false)}
            </>
          )}
        </main>

        {/*
          右栏：动画做法与左栏一致（外层裁切 + 内层定宽），另外两点不同：

          ⚠️ 1. 内层靠**右**贴齐（`ml-auto`）：右栏展开应该像"从右边拉开窗帘"，
                内容锚在右边缘不动。锚左边的话，面板里的文字会跟着一起平移。
          ⚠️ 2. `messages.length > 0` 之外仍不渲染 —— 空会话右栏没有任何可看的东西，
                与其摆一块写着"还没有成片"的空白面板，不如整块不渲染。
                这一条是刻意的，别为了动画让它常驻。
          ⚠️ 3. 展开后**保持挂载**（只收宽度）：面板里的播放器静音（`defaultMuted: !stage0`），
                所以不会出声；好处是收起再展开时播放进度、选中项都还在，
                不是每次都从头初始化。
        */}
        {messages.length > 0 && (
          <aside
            className={cn(
              "t-collapse hidden shrink-0 overflow-hidden lg:block",
              previewOpen ? "w-[375px]" : "w-0",
            )}
            inert={!previewOpen}
          >
            <div className="ml-auto h-full w-[375px] border-l border-border">
              <ArtifactPanel
                artifacts={artifacts}
                resetKey={threadId ?? "draft"}
                activeId={artifactOpenId}
                onActiveChange={setArtifactOpenId}
              />
            </div>
          </aside>
        )}
      </div>

      {/* 移动端：左右两栏降级成抽屉 */}
      {!isDesktop && (
        <Dialog open={navOpen} onOpenChange={setNavPref}>
          <SheetContent side="left" className="p-0">
            <DialogTitle className="sr-only">历史会话</DialogTitle>
            <ThreadSidebar
              threads={threads}
              activeId={threadId ?? ""}
              onSelect={(id) => {
                router.push(`/app/t/${id}`);
                setNavPref(false);
              }}
              onNew={() => {
                router.push("/app");
                setNavPref(false);
              }}
              ttlDays={ttlDays}
              onRename={(id, title) => void renameRemote(id, title)}
              onTogglePin={(id, pinned) => void togglePinRemote(id, pinned)}
              onShare={(id) => void shareRemote(id)}
              onDelete={(ids) => setPendingDelete(ids)}
            />
          </SheetContent>
        </Dialog>
      )}

      {!isWide && messages.length > 0 && (
        <Dialog open={previewOpen} onOpenChange={setPreviewPref}>
          <SheetContent side="right" className="p-0">
            <DialogTitle className="sr-only">产物</DialogTitle>
            <ArtifactPanel
              artifacts={artifacts}
              resetKey={threadId ?? "draft"}
              activeId={artifactOpenId}
              onActiveChange={setArtifactOpenId}
            />
          </SheetContent>
        </Dialog>
      )}

      {/*
        全屏不再走 Dialog。
        放大的对象就是播放器本身（由 VideoPlayer 内部调 requestFullscreen，
        不支持时降级为铺满视口），所以这里没有"全屏容器"要挂载 ——
        原来那个 VideoStage 居中弹窗已经被彻底移除，它正是用户说的"伪全屏、更像详情"。
      */}

      {/* 删除确认。这一步删的是磁盘上的文件（含已经渲好的视频），所以必须停下来问一次 */}
      <Dialog open={Boolean(pendingDelete)} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除 {pendingDelete?.length ?? 0} 条会话？</DialogTitle>
          </DialogHeader>
          <p className="text-xs leading-relaxed text-fg-muted">
            会连同这些会话的对话记录与
            <strong className="mx-0.5 font-medium text-fg">已渲染的视频</strong>
            一起删掉（成片、分段、增量缓存），
            <strong className="mx-0.5 font-medium text-fg">不可撤销</strong>。
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => pendingDelete && void doDelete(pendingDelete)}
            >
              删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 分享链接。文案只说"拿到链接的人能看什么"，别让人以为整段对话也公开了 */}
      <Dialog open={Boolean(shareInfo)} onOpenChange={(v) => !v && setShareInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分享链接</DialogTitle>
          </DialogHeader>
          <p className="text-xs leading-relaxed text-fg-muted">
            拿到链接的人可以打开看这条会话的
            <strong className="mx-0.5 font-medium text-fg">成片和分段</strong>
            ，不需要登录。对话内容不会出现在分享页上。
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Input
              readOnly
              value={shareInfo?.url ?? ""}
              className="h-9 flex-1"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(shareInfo?.url ?? "");
                toast("链接已复制");
              }}
            >
              复制
            </Button>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => shareInfo && void unshareRemote(shareInfo.id)}
            >
              取消分享
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShareInfo(null)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 整分镜替换：让模型重新输出一个完整分镜，而不是文本 patch */}
      <Dialog
        open={Boolean(reviseTarget)}
        onOpenChange={(v) => !v && setReviseTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>让 AI 改第 {(reviseTarget?.index ?? 0) + 1} 个分镜</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-fg-muted">
            会重新生成这一整个分镜（不是改一句话），其余分镜保持不变、也不会重新渲染。
          </p>
          <Textarea
            rows={3}
            value={reviseText}
            onChange={(e) => setReviseText(e.target.value)}
            placeholder="例如：这一步讲慢一点，多留 2 秒给公式"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReviseTarget(null)}>
              取消
            </Button>
            <Button
              size="sm"
              disabled={!reviseText.trim()}
              onClick={() => {
                if (!reviseTarget) return;
                void revise(reviseTarget.messageId, reviseTarget.index, reviseText.trim());
                setReviseTarget(null);
                setReviseText("");
              }}
            >
              重新生成这一分镜
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
