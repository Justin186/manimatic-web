import { NextResponse } from "next/server";

/**
 * POST /api/cancel —— Mock 实现。
 *
 * 真后端（`MathStoryboard/api/routes/cancel.py`）用来**显式**掐掉这条会话正在跑的
 * 任务。Mock 里没有可以掐的东西（那条流就是这个 Next 进程里的一个 `async` 循环），
 * 前端本地 abort 掉读流它自然就停了，所以这里只需要"认这个接口、回一句 ok"。
 *
 * ⚠️ 但**不能省略这个文件**：`USE_MOCK` 下前端的停止按钮照样会打这个地址，
 *    404 会让 `json()` 抛错（虽然前端把它 catch 掉了，但控制台会多一条红色报错，
 *    排查真问题时很碍事）。
 */
export async function POST() {
  return NextResponse.json({ ok: true, cancelled: 0 });
}
