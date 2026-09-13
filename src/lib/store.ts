"use client";

import { create } from "zustand";

import { DEMO_MODE } from "./api";
import { SEED_THREADS } from "./mock-data";
import type {
  Message,
  PlanStep,
  Profile,
  RenderState,
  SceneRender,
  StyleOverride,
  Thread,
} from "./types";

function seedMessages(): Record<string, Message[]> {
  const now = Date.now();
  return {
    demo: [
      {
        id: "m_seed_user",
        role: "user",
        text: "讲一下导数是什么",
        createdAt: now - 60_000,
      },
      {
        id: "m_seed_asst",
        role: "assistant",
        version: 1,
        text:
          "导数描述的是「变化有多快」。对 y = x² 来说，函数在 x 处的导数就是曲线在那一点切线的斜率；代入求导公式可得 y′ = 2x。所以 x = -1 时斜率为 -2，x = 0 时为 0，x = 3 时为 6 —— 切线会跟着点一起转动。",
        intent: "propose",
        plan: [
          { id: 1, title: "抛出问题", durationSec: 4.5, summary: "导数到底在量什么？先给一句直觉解释" },
          { id: 2, title: "画出抛物线", durationSec: 9, summary: "在坐标系上画出 y = x²" },
          { id: 3, title: "动点 + 切线", durationSec: 13, summary: "动点沿曲线滑动，切线实时跟随，右上角显示斜率" },
          { id: 4, title: "归纳结论", durationSec: 6, summary: "y′ = 2x，斜率随 x 线性变化" },
        ],
        planState: "confirmed",
        render: {
          status: "done",
          step: 4,
          total: 4,
          // durationSec 用**真实帧时长**（ffprobe 量出来的），与大纲设计值故意不同：
          // 预置会话要和真实链路一致，否则时间轴会照着一个骗人的数字铺。
          scenes: [
            { index: 0, title: "抛出问题", status: "done", url: "/demo/derivative_s0.mp4", durationSec: 5.199333 },
            { index: 1, title: "画出抛物线", status: "done", url: "/demo/derivative_s1.mp4", durationSec: 14.333333 },
            { index: 2, title: "动点 + 切线", status: "done", url: "/demo/derivative_s2.mp4", durationSec: 10.733008 },
            { index: 3, title: "归纳结论", status: "done", url: "/demo/derivative_s3.mp4", durationSec: 6.666667 },
          ],
          finalUrl: "/demo/derivative_full.mp4",
        },
        createdAt: now - 58_000,
      },
    ],
  };
}

/**
 * 初始态。
 *
 * 默认是**干净的空状态**；只有开了演示模式（`NEXT_PUBLIC_DEMO_MODE=true`）才用预置内容。
 *
 * 为什么要有这两个函数：这里以前是**无条件**用种子的，结果是"后端没连上"和
 * "真有历史数据"在界面上长得一模一样 —— 分不清就一定会误判。现在两者必须能区分开。
 */
function initialThreads(): Thread[] {
  return DEMO_MODE ? SEED_THREADS : [];
}

function initialMessages(): Record<string, Message[]> {
  return DEMO_MODE ? seedMessages() : {};
}

type State = {
  threads: Thread[];
  messages: Record<string, Message[]>;
  activeId: string;
  activeMessageId: string | null;
  profile: Profile;
  /** 讲解风格：只在这里（设置页）改，工作台不再放切换条 */
  style: StyleOverride;

  setActive: (id: string) => void;
  setActiveMessage: (id: string | null) => void;
  setProfile: (p: Profile) => void;
  setStyle: (s: StyleOverride) => void;
  /**
   * 把一条会话登记进侧栏。**只在真正发出第一条消息时才该调用** ——
   * 见 create 里那段说明：新建对话本身不该在侧栏留下一条空会话。
   */
  ensureThread: (id: string, title?: string) => void;

  appendMessage: (threadId: string, msg: Message) => void;
  patchMessage: (threadId: string, id: string, patch: Partial<Message>) => void;
  patchRender: (threadId: string, id: string, patch: Partial<RenderState>) => void;
  patchScene: (threadId: string, id: string, index: number, patch: Partial<SceneRender>) => void;
  setPlan: (threadId: string, id: string, plan: PlanStep[]) => void;

  /** 用后端返回的会话列表**整体替换**本地列表（刷新后恢复，见 Workbench） */
  hydrateThreads: (list: Thread[]) => void;
  /** 用后端返回的某个会话的消息**整体替换**本地那一条 */
  hydrateMessages: (threadId: string, messages: Message[]) => void;
  /** 本地更新一条会话的属性（改名 / 置顶），并照服务端的规则重排 */
  patchThreadLocal: (id: string, patch: Partial<Thread>) => void;
  /** 本地移除若干会话。**只在删除接口已经成功之后**才调用 */
  removeThreadsLocal: (ids: string[]) => void;
};

export const useStore = create<State>((set) => ({
  threads: initialThreads(),
  messages: initialMessages(),
  // 演示模式停在预置的那个会话上；正常情况没有 activeId，
  // 由 Workbench 按路由里的 threadId 设定。
  activeId: DEMO_MODE ? "demo" : "",
  activeMessageId: DEMO_MODE ? "m_seed_asst" : null,
  profile: { role: "student", grade: "高中", subjects: ["数学"] },
  style: "detailed",

  setActive: (id) => set({ activeId: id, activeMessageId: null }),
  setActiveMessage: (id) => set({ activeMessageId: id }),
  setProfile: (p) => set({ profile: p }),
  setStyle: (s) => set({ style: s }),

  // 水合**不动 activeId**：谁是当前会话由路由（Workbench 的 threadId）说了算，
  // 在这里插一脚只会造出"路由/内容是 A、侧栏高亮 B"这种对不上的状态。
  //
  // 而且这里是**整体替换、不做保留**：曾经会把"当前会话"补回列表（怕它从侧栏消失），
  // 但那正好和用户要的行为相反 —— 一条还没说过话的会话就不该出现在列表里。
  // 后端是唯一事实来源，它没有就没有。
  hydrateThreads: (list) => set({ threads: list }),

  hydrateMessages: (threadId, messages) =>
    set((s) => ({ messages: { ...s.messages, [threadId]: messages } })),

  patchThreadLocal: (id, patch) =>
    set((s) => ({
      threads: s.threads
        .map((t) => (t.id === id ? { ...t, ...patch } : t))
        // 排序规则必须和服务端 list_threads 一致（置顶优先，再按最近更新），
        // 否则"刚置顶的那条"要刷新一下才跳到最上面。
        .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt),
    })),

  removeThreadsLocal: (ids) =>
    set((s) => {
      const drop = new Set(ids);
      const messages = { ...s.messages };
      for (const id of ids) delete messages[id];
      return { threads: s.threads.filter((t) => !drop.has(t.id)), messages };
    }),

  /**
   * 把一条会话登记进侧栏。
   *
   * ⚠️ 调用时机是关键：**只在真正发出第一条消息时才调**。
   *    以前"点新建"就会调它，于是侧栏立刻多出一条「新的讲解」—— 用户只是点了一下、
   *    一个字都没说，那条就已经在那儿了；切走也不会消失，点几次就攒几条。
   *    现在新建只是进入一个"草稿"界面，**id 要到发消息那一刻才生成**，
   *    没说过话的草稿根本不存在于列表里，也就无所谓"消失"。
   */
  ensureThread: (id, title) =>
    set((s) => {
      if (s.threads.some((t) => t.id === id)) {
        // 已在列表里：只补标题（重新生成那类场景），别重复插入
        return title
          ? { threads: s.threads.map((t) => (t.id === id ? { ...t, title } : t)) }
          : {};
      }
      return {
        threads: [
          { id, title: title || "新的讲解", subtitle: "待生成", updatedAt: Date.now() },
          ...s.threads,
        ],
      };
    }),


  appendMessage: (threadId, msg) =>
    set((s) => ({
      messages: { ...s.messages, [threadId]: [...(s.messages[threadId] ?? []), msg] },
      activeMessageId: msg.role === "assistant" ? msg.id : s.activeMessageId,
      threads: s.threads.map((t) =>
        t.id === threadId ? { ...t, updatedAt: Date.now() } : t,
      ),
    })),

  patchMessage: (threadId, id, patch) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [threadId]: (s.messages[threadId] ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
      },
    })),

  patchRender: (threadId, id, patch) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [threadId]: (s.messages[threadId] ?? []).map((m) =>
          m.id === id && m.render ? { ...m, render: { ...m.render, ...patch } } : m,
        ),
      },
    })),

  patchScene: (threadId, id, index, patch) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [threadId]: (s.messages[threadId] ?? []).map((m) => {
          if (m.id !== id || !m.render) return m;
          return {
            ...m,
            render: {
              ...m.render,
              scenes: m.render.scenes.map((sc) =>
                sc.index === index ? { ...sc, ...patch } : sc,
              ),
            },
          };
        }),
      },
    })),

  setPlan: (threadId, id, plan) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [threadId]: (s.messages[threadId] ?? []).map((m) => (m.id === id ? { ...m, plan } : m)),
      },
    })),
}));
