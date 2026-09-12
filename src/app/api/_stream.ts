import { DERIVATIVE, PYTHAGOREAN, pickCanned, type Canned } from "@/lib/mock-data";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type Sender = (event: string, data: unknown) => void;

/** 把一个异步生成器包装成 SSE 响应 */
export function sse(setup: (send: Sender) => Promise<void>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: Sender = (event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        await setup(send);
      } catch (err) {
        send("error", {
          scope: "task",
          message: err instanceof Error ? err.message : String(err),
          retryable: false,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export function chunk(text: string, size = 12): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/**
 * Mock 的"会话记忆"。
 * 真实后端有 task 目录可查，Mock 只能靠内存记住：
 * 这个会话刚才讲的是哪道题（决定用哪组分镜片段）、还有哪些分镜处于失败态。
 */
const CANNED_BY_THREAD = new Map<string, string>();
const FAILURES = new Map<string, Set<number>>();

export function rememberCanned(threadId: string, question: string): Canned {
  const canned = pickCanned(question ?? "");
  CANNED_BY_THREAD.set(threadId, canned.key);
  return canned;
}

export function recallCanned(threadId: string): Canned {
  const key = CANNED_BY_THREAD.get(threadId);
  if (key === PYTHAGOREAN.key) return PYTHAGOREAN;
  if (key === DERIVATIVE.key) return DERIVATIVE;
  return DERIVATIVE;
}

export function setFailures(threadId: string, indices: number[]) {
  FAILURES.set(threadId, new Set(indices));
}

export function clearFailure(threadId: string, index: number): boolean {
  const set = FAILURES.get(threadId);
  if (!set) return true;
  set.delete(index);
  return set.size === 0;
}

export function hasFailures(threadId: string) {
  return (FAILURES.get(threadId)?.size ?? 0) > 0;
}
