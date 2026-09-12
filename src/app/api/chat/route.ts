import { chunk, rememberCanned, sleep, sse } from "../_stream";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat —— Mock 实现。
 *
 * 事件顺序刻意保持 brief（文字）在前、plan（大纲）在后：
 * 真实实现里后端会要求模型按 brief → intent → outline → scenes 的顺序输出
 * （见 docs/前端接入-后端改造清单.md §3.2），这样流式时 1~2 秒就有字可显示，
 * 前端不必为了"秒级见字"把一次 LLM 调用拆成两次。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    thread_id?: string;
    message?: string;
  };
  const threadId = body.thread_id ?? "demo";
  const canned = rememberCanned(threadId, body.message ?? "");

  return sse(async (send) => {
    for (const piece of chunk(canned.brief, 10)) {
      send("text_delta", { text: piece });
      await sleep(38);
    }

    await sleep(220);
    if (canned.intent === "propose") {
      send("plan", { plan: canned.plan, intent: "propose" });
    } else {
      // 纯概念问答：不出大纲，这条消息到此结束，就是一次普通对话
      send("plan", { plan: [], intent: "none" });
    }

    send("done", { messageId: `m_${Date.now()}` });
  });
}
