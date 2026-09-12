"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { confirmRender, replaceScene, retryScene, streamChat } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useLocalStorage, useMediaQuery } from "@/lib/use-ui";
import { uid } from "@/lib/utils";
import type { Message, PlanStep, RenderState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, SheetContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/primitives";

import { ArtifactPanel, type Artifact } from "./ArtifactPanel";
import { ChatStream } from "./ChatStream";
import { Composer } from "./Composer";
import { ThreadSidebar } from "./ThreadSidebar";
import { TopBar } from "./TopBar";

const EMPTY: Message[] = [];

export function Workbench({ threadId }: { threadId: string }) {
  const router = useRouter();

  const threads = useStore((s) => s.threads);
  const messages = useStore((s) => s.messages[threadId] ?? EMPTY);
  const profile = useStore((s) => s.profile);
  const style = useStore((s) => s.style);

  const appendMessage = useStore((s) => s.appendMessage);
  const patchMessage = useStore((s) => s.patchMessage);
  const patchRender = useStore((s) => s.patchRender);
  const patchScene = useStore((s) => s.patchScene);
  const setActive = useStore((s) => s.setActive);
  const ensureThread = useStore((s) => s.ensureThread);
  const createThread = useStore((s) => s.newThread);
  const renameThread = useStore((s) => s.renameThread);

  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);

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

  const abortRef = useRef<AbortController | null>(null);
  const autoRetried = useRef<Set<string>>(new Set());

  useEffect(() => {
    ensureThread(threadId);
    setActive(threadId);
  }, [threadId, ensureThread, setActive]);

  /* ---------------- 事件分发 ---------------- */

  function handleEvent(messageId: string, name: string, data: unknown) {
    const d = (data ?? {}) as Record<string, unknown>;

    switch (name) {
      case "tool_progress": {
        const step = Number(d.step ?? 0);
        const stage = d.stage as RenderState["stage"];
        patchRender(threadId, messageId, {
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
          const msg = (st.messages[threadId] ?? []).find((m) => m.id === messageId);
          const cur = msg?.render?.scenes[step];
          if (cur?.status === "queued") {
            patchScene(threadId, messageId, cur.index, { status: "rendering" });
          }
        }
        break;
      }

      case "tool_result":
        patchScene(threadId, messageId, Number(d.index ?? 0), {
          status: "done",
          url: String(d.url ?? ""),
          durationSec: Number(d.durationSec ?? 0),
        });
        break;

      case "tool_done":
        patchRender(threadId, messageId, { status: "done", finalUrl: String(d.url ?? "") });
        break;

      case "error": {
        const scope = d.scope as "step" | "task";
        if (scope === "step") {
          const index = Number(d.index ?? 0);
          patchScene(threadId, messageId, index, {
            status: "error",
            message: String(d.message ?? "渲染失败"),
          });
          if (d.retryable !== false) autoRetry(messageId, index);
        } else {
          patchMessage(threadId, messageId, { error: String(d.message ?? "生成失败") });
          patchRender(threadId, messageId, { status: "error" });
        }
        break;
      }

      case "done": {
        const st = useStore.getState();
        const msg = (st.messages[threadId] ?? []).find((m) => m.id === messageId);
        const hasError = msg?.render?.scenes.some((s) => s.status === "error") ?? false;
        const hasFinal = Boolean(msg?.render?.finalUrl);
        patchRender(threadId, messageId, {
          status: hasError ? "error" : hasFinal ? "done" : "running",
        });
        break;
      }
    }
  }

  async function doRetry(messageId: string, index: number) {
    setRetrying(index);
    patchScene(threadId, messageId, index, { status: "queued", message: undefined });
    try {
      await retryScene({ thread_id: threadId, message_id: messageId, scene_index: index }, (n, d) =>
        handleEvent(messageId, n, d),
      );
    } catch (err) {
      patchScene(threadId, messageId, index, {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRetrying(null);
    }
  }

  /** Q12：自动重试 1 次；再失败就交给用户点按钮，绝不整条任务失败 */
  function autoRetry(messageId: string, index: number) {
    const key = `${messageId}:${index}`;
    if (autoRetried.current.has(key)) return;
    autoRetried.current.add(key);
    window.setTimeout(() => void doRetry(messageId, index), 900);
  }

  function appendText(messageId: string, delta: string) {
    const st = useStore.getState();
    const msg = (st.messages[threadId] ?? []).find((m) => m.id === messageId);
    if (!msg) return;
    patchMessage(threadId, messageId, { text: msg.text + delta });
  }

  /* ---------------- 主动作 ---------------- */

  async function send(text: string) {
    if (busy) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);

    appendMessage(threadId, { id: uid("mu"), role: "user", text, createdAt: Date.now() });
    const asstId = uid("ma");
    appendMessage(threadId, {
      id: asstId,
      role: "assistant",
      text: "",
      streaming: true,
      version: 1,
      createdAt: Date.now(),
    });

    const cur = threads.find((t) => t.id === threadId);
    if (cur && (cur.title === "新的讲解" || cur.title === "默认会话")) {
      renameThread(threadId, text.slice(0, 20));
    }

    try {
      await streamChat(
        { thread_id: threadId, message: text, profile, overrides: { style } },
        (name, data) => {
          const d = (data ?? {}) as Record<string, unknown>;
          if (name === "text_delta") {
            appendText(asstId, String(d.text ?? ""));
          } else if (name === "plan") {
            const plan = (d.plan ?? []) as PlanStep[];
            const intent = (d.intent ?? "none") as "propose" | "none";
            patchMessage(threadId, asstId, {
              plan,
              intent,
              planState: intent === "propose" ? "pending" : "none",
            });
          } else if (name === "done") {
            patchMessage(threadId, asstId, { streaming: false });
          } else if (name === "error") {
            patchMessage(threadId, asstId, {
              streaming: false,
              error: String(d.message ?? "生成失败"),
            });
          }
        },
        ctrl.signal,
      );
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      patchMessage(threadId, asstId, {
        streaming: false,
        error: aborted ? undefined : err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  async function confirm(messageId: string) {
    const st = useStore.getState();
    const msg = (st.messages[threadId] ?? []).find((m) => m.id === messageId);
    if (!msg?.plan?.length) return;
    const plan = msg.plan;

    patchMessage(threadId, messageId, {
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
    setBusy(true);
    try {
      await confirmRender(
        { thread_id: threadId, message_id: messageId, plan, simulateFailure },
        (n, d) => handleEvent(messageId, n, d),
      );
    } catch (err) {
      patchMessage(threadId, messageId, {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(messageId: string) {
    const st = useStore.getState();
    const list = st.messages[threadId] ?? [];
    const idx = list.findIndex((m) => m.id === messageId);
    const question = [...list.slice(0, idx)].reverse().find((m) => m.role === "user")?.text;
    if (!question) return;
    patchMessage(threadId, messageId, { text: "", plan: undefined, planState: undefined, streaming: true });
    setBusy(true);
    try {
      await streamChat({ thread_id: threadId, message: question, profile, overrides: { style } }, (n, d) => {
        const dd = (d ?? {}) as Record<string, unknown>;
        if (n === "text_delta") appendText(messageId, String(dd.text ?? ""));
        else if (n === "plan") {
          const plan = (dd.plan ?? []) as PlanStep[];
          const intent = (dd.intent ?? "none") as "propose" | "none";
          patchMessage(threadId, messageId, {
            plan,
            intent,
            planState: intent === "propose" ? "pending" : "none",
            streaming: false,
          });
        } else if (n === "done") patchMessage(threadId, messageId, { streaming: false });
      });
    } finally {
      setBusy(false);
    }
  }

  /** Q16：整分镜替换 —— 每次修正生成一条新消息（v1/v2/v3 并列，保留不同方向的尝试） */
  async function revise(messageId: string, index: number, instruction: string) {
    const st = useStore.getState();
    const src = (st.messages[threadId] ?? []).find((m) => m.id === messageId);
    if (!src?.render) return;

    const newId = uid("ma");
    appendMessage(threadId, {
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

    setBusy(true);
    try {
      await replaceScene(
        {
          thread_id: threadId,
          message_id: newId,
          scene_index: index,
          instruction,
          durationSec: src.render.scenes[index]?.durationSec ?? 8,
        },
        (n, d) => handleEvent(newId, n, d),
      );
    } catch (err) {
      patchMessage(threadId, newId, { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
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

  const title = threads.find((t) => t.id === threadId)?.title ?? "新的讲解";

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <TopBar
        title={title}
        navOpen={navOpen}
        previewOpen={previewOpen}
        onToggleNav={() => setNavPref(!navOpen)}
        onTogglePreview={() => setPreviewPref(!previewOpen)}
        onNewThread={() => router.push(`/app/t/${createThread()}`)}
      />

      <div className="flex min-h-0 flex-1">
        {navOpen && (
          <aside className="hidden w-72 shrink-0 border-r border-line md:block">
            <ThreadSidebar
              threads={threads}
              activeId={threadId}
              onSelect={(id) => router.push(`/app/t/${id}`)}
              onNew={() => router.push(`/app/t/${createThread()}`)}
            />
          </aside>
        )}

        {/* 中栏最小宽度 530px：不按比例无限压缩，否则两侧全展开时对话区会被挤成一条 */}
        <main className="flex min-w-0 flex-1 flex-col md:min-w-[530px]">
          <ChatStream
            messages={messages}
            busy={busy}
            retryingIndex={retrying}
            onPlanChange={(id, plan) => patchMessage(threadId, id, { plan: plan ?? undefined })}
            onConfirm={confirm}
            onRegenerate={regenerate}
            onRetry={(id, index) => void doRetry(id, index)}
            onRevise={(id, index) => setReviseTarget({ messageId: id, index })}
            onOpenArtifact={openArtifact}
          />
          <Composer
            busy={busy}
            onSend={send}
            onAbort={() => abortRef.current?.abort()}
            simulateFailure={simulateFailure}
            onSimulateFailureChange={setSimulateFailure}
          />
        </main>

        {previewOpen && (
          <aside className="hidden w-[375px] shrink-0 border-l border-line lg:block">
            <ArtifactPanel
              artifacts={artifacts}
              resetKey={threadId}
              activeId={artifactOpenId}
              onActiveChange={setArtifactOpenId}
            />
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
              activeId={threadId}
              onSelect={(id) => {
                router.push(`/app/t/${id}`);
                setNavPref(false);
              }}
              onNew={() => {
                router.push(`/app/t/${createThread()}`);
                setNavPref(false);
              }}
            />
          </SheetContent>
        </Dialog>
      )}

      {!isWide && (
        <Dialog open={previewOpen} onOpenChange={setPreviewPref}>
          <SheetContent side="right" className="p-0">
            <DialogTitle className="sr-only">产物</DialogTitle>
            <ArtifactPanel
              artifacts={artifacts}
              resetKey={threadId}
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

      {/* 整分镜替换：让模型重新输出一个完整分镜，而不是文本 patch */}
      <Dialog
        open={Boolean(reviseTarget)}
        onOpenChange={(v) => !v && setReviseTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>让 AI 改第 {(reviseTarget?.index ?? 0) + 1} 个分镜</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-ink-soft">
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
