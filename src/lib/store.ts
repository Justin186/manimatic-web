"use client";

import { create } from "zustand";

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
import { uid } from "./utils";

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
  ensureThread: (id: string) => void;
  newThread: () => string;
  renameThread: (id: string, title: string) => void;

  appendMessage: (threadId: string, msg: Message) => void;
  patchMessage: (threadId: string, id: string, patch: Partial<Message>) => void;
  patchRender: (threadId: string, id: string, patch: Partial<RenderState>) => void;
  patchScene: (threadId: string, id: string, index: number, patch: Partial<SceneRender>) => void;
  setPlan: (threadId: string, id: string, plan: PlanStep[]) => void;
};

export const useStore = create<State>((set) => ({
  threads: SEED_THREADS,
  messages: seedMessages(),
  activeId: "demo",
  activeMessageId: "m_seed_asst",
  profile: { role: "student", grade: "高中", subjects: ["数学"] },
  style: "detailed",

  setActive: (id) => set({ activeId: id, activeMessageId: null }),
  setActiveMessage: (id) => set({ activeMessageId: id }),
  setProfile: (p) => set({ profile: p }),
  setStyle: (s) => set({ style: s }),

  ensureThread: (id) =>
    set((s) =>
      s.threads.some((t) => t.id === id)
        ? s
        : {
            threads: [
              { id, title: "新的讲解", subtitle: "待生成", updatedAt: Date.now() },
              ...s.threads,
            ],
            messages: { ...s.messages, [id]: [] },
          },
    ),

  newThread: () => {
    const id = uid("t");
    set((s) => ({
      threads: [
        { id, title: "新的讲解", subtitle: "待生成", updatedAt: Date.now() },
        ...s.threads,
      ],
      messages: { ...s.messages, [id]: [] },
      activeId: id,
      activeMessageId: null,
    }));
    return id;
  },

  renameThread: (id, title) =>
    set((s) => ({
      threads: s.threads.map((t) => (t.id === id ? { ...t, title, updatedAt: Date.now() } : t)),
    })),

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
