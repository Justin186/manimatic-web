import type { NextConfig } from "next";

/**
 * 后端的真实地址（run_api.bat 起的那个 FastAPI）。
 *
 * 注意这是**给 dev server 自己用的**（服务端转发），不是给浏览器用的 ——
 * 浏览器那边只认 .env.local 里的 `NEXT_PUBLIC_API_BASE_URL=/msb`。
 */
const BACKEND = "http://127.0.0.1:8000";

/** 前端走后端代理的路径前缀。改这里要同步改 .env.local 的 NEXT_PUBLIC_API_BASE_URL */
const PROXY_PREFIX = "/msb";

const nextConfig: NextConfig = {
  /**
   * 允许哪些来源访问 dev-only 的资源（HMR 的 WebSocket、`/_next/*` 里的 RSC 产物等）。
   *
   * 默认只放行 localhost 及其子域，于是局域网机器打开 `http://10.x.x.x:3000` 时，
   * 它发来的请求带着 `Origin: http://10.x.x.x:3000`，会被 403 拦掉并打一条
   * "Blocked cross-origin request to Next.js dev resource" —— 症状是页面能打开，
   * 但热更新不工作、切换路由缺资源，看起来像"局域网访问时好时坏"。
   *
   * 这里用通配段而不是写死当前那台机器的 IP：`*` 只匹配**一段**主机名，
   * 所以 10.*.*.* 覆盖整个 10.0.0.0/8 内网段 —— 换 Wi-Fi、换 IP 都不用回来改这里。
   * 只在 dev 生效，`next build` 出来的产物完全不看它。
   */
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*"],

  /**
   * 同源代理：`/msb/api/*`、`/msb/media/*` → 后端。
   *
   * 为什么需要它：局域网里别人访问的是 `10.x.x.x:3000`，而他浏览器里的 `localhost`
   * 指**他自己那台机器**。所以过去那句 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
   * 在局域网下必然失败（数据拉不到、视频全 404）；改成写死本机 IP 又会在换网段时失效。
   * 走代理后浏览器只跟 3000 说话，由 dev server 在**同一台机器上**转发给后端 ——
   * 顺带把 CORS 也消掉了（同源），而且换机器、换 IP 都不用改任何配置。
   *
   * ⚠️ 用的是独立前缀 /msb，不直接吃 /api/*：
   *    `src/app/api/` 下有一整套 Mock 的 Route Handler，同前缀会跟它抢路由，
   *    "Mock 模式和真后端到底谁接了这一发"是那种极难排查的问题。
   * ⚠️ 这里是**dev server 转发**，只在本机跑着前端时才成立（生产要换成网关反代）。
   */
  async rewrites() {
    return [{ source: `${PROXY_PREFIX}/:path*`, destination: `${BACKEND}/:path*` }];
  },

  /**
   * 转发（rewrites）到后端的**上游空闲超时**，单位毫秒。
   *
   * ⚠️ Next 的默认值是 **30 秒**，且这不是"整个请求最多 30 秒"，而是**socket 空闲超时**：
   *    上游 30 秒没吐字节，代理就把这条连接掐掉。
   *    出处：node_modules/next/dist/server/lib/router-utils/proxy-request.js
   *         `proxyTimeout: proxyTimeout === null ? undefined : proxyTimeout || 30000`
   *
   * 生成大纲恰好会长时间**一个字节都不发** —— 开深度思考的模型光思考就 50 秒起步
   * （实测首字 ~50s，长思考可到几分钟），这期间 SSE 流上是空的。
   * 症状就是"生成半天、前端却报 network error"，而后端那条任务明明还在正常跑。
   * 后端侧的对策是定期发 SSE 心跳（api/pipeline.py，MSB_SSE_HEARTBEAT_SEC，默认 15s）；
   * 这里把代理的魔数放大到 30 分钟（比后端单条渲染超时 RENDER_TIMEOUT=900s 还大一倍），
   * 让"空闲"由心跳去解决，而不是由代理层替我们做决定。
   *
   * ⚠️ 别写 `null`：源码里只有 `=== null` 才表示"不超时"，但配置 schema 是 `.number()`，
   *    写 null 会被校验打回（并打一条 Invalid next.config 警告）。写一个大数最稳。
   * ⚠️ `experimental.*` 只在 `next dev` 生效；生产是网关反代，超时要单独配（≥120s）。
   */
  experimental: { proxyTimeout: 30 * 60 * 1000 },
};

export default nextConfig;
