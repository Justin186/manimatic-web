import { chunk, rememberCanned, sleep, sse } from "../_stream";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat —— Mock 实现。
 *
 * 事件顺序刻意保持 brief（文字）在前、plan（大纲）在后：
 * 真实实现里后端会要求模型按 brief → intent → outline → scenes 的顺序输出
 * （见 docs/前端接入-后端改造清单.md §3.2），这样流式时 1~2 秒就有字可显示，
 * 前端不必为了"秒级见字"把一次 LLM 调用拆成两次。
 *
 * 带图也走**这一个**端点（可选 `images` 字段），与真后端保持一致 ——
 * 后端把它做成了同一个 `/api/chat`，不再有独立的 `/api/vi/chat`
 * （见 MathStoryboard/HANDOFF.md §8.68）。
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    thread_id?: string;
    message?: string;
    images?: { data?: string }[];
  };
  const threadId = body.thread_id ?? "demo";
  const images = (body.images ?? []).filter((it) => it && it.data);
  // 只传了图没写字时，给一个可匹配的占位题目 —— 否则 pickCanned("")
  // 会落到"纯概念问答"分支，看不出这是读图链路。
  const canned = rememberCanned(threadId, body.message || "题目图片");

  return sse(async (send) => {
    // 先模拟"深度思考"：真链路下正文之前有一段只有 thinking_delta 的时间
    // （实测 40~90 秒，见 MathStoryboard/HANDOFF.md §8.12）。
    // 少了这一段，前端那块"正在思考…"在本地就永远测不到。
    // 用 12ms/块（真链路是几秒一个字符的节奏压过来的），演示时不至于真的要等一分钟。
    if (canned.thinking) {
      for (const piece of chunk(canned.thinking, 8)) {
        send("thinking_delta", { text: piece });
        await sleep(12);
      }
      await sleep(180);
    }

    // 带图时先说明"读到了几张图"。真链路上这段是模型自己说的话（它读过图之后
    // 才会写 brief），Mock 里手写一句，作用是让"带图链路走通了"在界面上看得见。
    if (images.length) {
      for (const piece of chunk(`（已读取 ${images.length} 张题目图片）`, 6)) {
        send("text_delta", { text: piece });
        await sleep(30);
      }
      await sleep(120);
    }

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
