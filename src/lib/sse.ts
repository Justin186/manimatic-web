/**
 * 极简 SSE 客户端。
 *
 * 为什么手写而不上 Vercel AI SDK：后端是**自建的 Python SSE**（见
 * docs/前端接入-后端改造清单.md），事件名是 text_delta / tool_progress 这一套，
 * 不是 AI SDK 的 data protocol。套 SDK 反而要写协议适配层，多一个依赖多一层魔法。
 */

export type SSEHandler = (event: string, data: unknown) => void;

function parseChunk(chunk: string): { event: string; data: unknown } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of chunk.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (!dataLines.length) return null;
  const raw = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: raw };
  }
}

export async function readSSE(res: Response, onEvent: SSEHandler) {
  if (!res.body) throw new Error("响应没有 body —— 服务端没有返回流式响应");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 事件之间以空行分隔；最后一段可能不完整，留在 buffer 里等下一帧
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const parsed = parseChunk(chunk);
      if (parsed) onEvent(parsed.event, parsed.data);
    }
  }
}
