"use client";

import { create } from "zustand";

import { DEMO_MODE } from "./api";
// 预置会话的内容从这里派生（见 seedMessages 的说明）—— 演示数据只此一份
import { DERIVATIVE, SEED_THREADS } from "./mock-data";
import type {
  Message,
  PlanStep,
  Profile,
  RenderState,
  SceneRender,
  StyleOverride,
  Thread,
} from "./types";

/**
 * 预置会话（只有 `NEXT_PUBLIC_DEMO_MODE=true` 才会有）。
 *
 * ⚠️ 内容**全部从 `DERIVATIVE` 派生**，绝不在这里再抄一份。
 *    原来是手抄的一份，而它与 `mock-data.ts` 各写各的 —— 实测已经漂移过：
 *    预置会话指着 4 个分镜的旧片段（`derivative_s0~s3`），
 *    而演示成片早就换成了 5 镜的 few-shot 示例，于是点开预置会话
 *    看到的是**另一段视频**，而且分镜数对不上。两份数据迟早会分叉，这是必然。
 *
 * ⚠️ `durationSec` 用 `segmentDurations`（ffprobe 量的真实帧时长），
 *    不是 `plan[].durationSec`（大纲设计值）：预置会话要和真实链路一致，
 *    否则时间轴会照着一个骗人的数字铺（见 timeline.ts 的说明）。
 */
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
        text: DERIVATIVE.brief,
        // 整片标题：分享弹窗与播放器左上角都读它（原来是缺的，于是那些地方
        // 只能退到第一个分镜的名字 —— 见 types.ts 的 videoTitleOf）
        videoTitle: DERIVATIVE.title,
        intent: DERIVATIVE.intent,
        plan: DERIVATIVE.plan,
        planState: "confirmed",
        render: {
          status: "done",
          step: DERIVATIVE.segments.length,
          total: DERIVATIVE.plan.length,
          scenes: DERIVATIVE.plan.map((p, i) => ({
            index: i,
            title: p.title,
            status: "done" as const,
            url: DERIVATIVE.segments[i],
            durationSec: DERIVATIVE.segmentDurations[i],
          })),
          finalUrl: DERIVATIVE.final,
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
